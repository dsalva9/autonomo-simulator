import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  type AssetManifest,
  type BalanceConfig,
  BalanceConfigSchema,
  type CharacterDef,
  CharacterSchema,
  type ChoiceSpec,
  type EffectsSpec,
  type EventCategory,
  EventCategorySchema,
  type EventDef,
  EventSchema,
  hasActiveRequirements,
} from "../src/engine/schemas/index.ts";
import { validateAssets } from "./validate-assets.ts";

export interface ContentValidationResult {
  ok: boolean;
  balance: BalanceConfig | null;
  characters: Record<string, CharacterDef>;
  events: EventDef[];
  manifest: AssetManifest | null;
  errors: string[];
}

export function loadAndValidateContent(rootDir = process.cwd()): ContentValidationResult {
  const errors: string[] = [];

  const assetResult = validateAssets(rootDir);
  if (!assetResult.ok) {
    errors.push(...assetResult.errors);
  }
  const manifest = assetResult.manifest;

  const balancePath = resolve(rootDir, "content", "config", "balance.yaml");
  let balance: BalanceConfig | null = null;
  if (!existsSync(balancePath)) {
    errors.push("Missing content/config/balance.yaml.");
  } else {
    const rawBalance = safeParseYamlFile(balancePath, errors);
    if (rawBalance !== undefined) {
      const parsed = BalanceConfigSchema.safeParse(rawBalance);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push(`content/config/balance.yaml [${issue.path.join(".")}]: ${issue.message}`);
        }
      } else {
        balance = parsed.data;
      }
    }
  }

  const characters: Record<string, CharacterDef> = {};
  const charactersDir = resolve(rootDir, "content", "characters");
  if (!existsSync(charactersDir)) {
    errors.push("Missing content/characters/ directory.");
  } else {
    const charFiles = listYamlFiles(charactersDir, "content/characters", errors);
    for (const filePath of charFiles) {
      const stem = basename(filePath, extname(filePath));
      const relLabel = `content/characters/${basename(filePath)}`;
      const rawDoc = safeParseYamlFile(filePath, errors);
      if (rawDoc === undefined) {
        continue;
      }
      const parsed = CharacterSchema.safeParse(rawDoc);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push(`${relLabel} [${issue.path.join(".")}]: ${issue.message}`);
        }
        continue;
      }
      const charDef = parsed.data;
      if (charDef.id !== stem) {
        errors.push(
          `${relLabel}: character id '${charDef.id}' must match filename stem '${stem}'.`,
        );
      }
      if (characters[charDef.id]) {
        errors.push(`${relLabel}: duplicate character id '${charDef.id}'.`);
      }
      if (manifest) {
        const assetEntry = manifest.assets[charDef.portrait_asset_id];
        if (!assetEntry) {
          errors.push(
            `${relLabel}: portrait_asset_id '${charDef.portrait_asset_id}' not found in assets/manifest.json.`,
          );
        } else if (assetEntry.category !== "character") {
          errors.push(
            `${relLabel}: portrait_asset_id '${charDef.portrait_asset_id}' must have category 'character' (found '${assetEntry.category}').`,
          );
        }
      }
      characters[charDef.id] = charDef;
    }
  }

  const events: EventDef[] = [];
  const eventsById = new Map<string, EventDef>();
  const categories = EventCategorySchema.options;
  const eventsRoot = resolve(rootDir, "content", "events");

  if (!existsSync(eventsRoot)) {
    errors.push("Missing content/events/ directory.");
  } else {
    for (const category of categories) {
      const catDir = resolve(eventsRoot, category);
      if (!existsSync(catDir)) {
        continue;
      }
      const eventFiles = listYamlFiles(catDir, `content/events/${category}`, errors);
      for (const filePath of eventFiles) {
        const stem = basename(filePath, extname(filePath));
        const relLabel = `content/events/${category}/${basename(filePath)}`;
        const rawDoc = safeParseYamlFile(filePath, errors);
        if (rawDoc === undefined) {
          continue;
        }
        const parsed = EventSchema.safeParse(rawDoc);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push(`${relLabel} [${issue.path.join(".")}]: ${issue.message}`);
          }
          continue;
        }
        const eventDef = parsed.data;
        validateSingleEventFileRules(eventDef, stem, category, relLabel, errors);

        if (eventsById.has(eventDef.id)) {
          errors.push(`${relLabel}: duplicate event id '${eventDef.id}'.`);
        } else {
          eventsById.set(eventDef.id, eventDef);
          events.push(eventDef);
        }
      }
    }
  }

  events.sort((a, b) => a.id.localeCompare(b.id));

  validateCrossReferencesAndGraph(events, eventsById, characters, manifest, errors);

  return {
    ok: errors.length === 0,
    balance,
    characters,
    events,
    manifest,
    errors,
  };
}

function validateSingleEventFileRules(
  event: EventDef,
  stem: string,
  folderCategory: EventCategory,
  relLabel: string,
  errors: string[],
): void {
  if (event.id !== stem) {
    errors.push(`${relLabel}: event id '${event.id}' must match filename stem '${stem}'.`);
  }
  if (event.category !== folderCategory) {
    errors.push(
      `${relLabel}: event category '${event.category}' must match directory '${folderCategory}'.`,
    );
  }
  const requiredPrefix = `${folderCategory}_`;
  if (!event.id.startsWith(requiredPrefix)) {
    errors.push(`${relLabel}: event id '${event.id}' must start with '${requiredPrefix}'.`);
  }
  if (event.choices.length < 2) {
    errors.push(`${relLabel}: event '${event.id}' must define at least 2 choices.`);
  }
  const unconditionalCount = event.choices.filter(
    (c) => !hasActiveRequirements(c.requirements),
  ).length;
  if (unconditionalCount < 1) {
    errors.push(
      `${relLabel}: event '${event.id}' must include at least 1 unconditional choice (no requirements).`,
    );
  }
}

function validateCrossReferencesAndGraph(
  events: readonly EventDef[],
  eventsById: ReadonlyMap<string, EventDef>,
  characters: Readonly<Record<string, CharacterDef>>,
  manifest: AssetManifest | null,
  errors: string[],
): void {
  const incomingScheduledCount = new Map<string, number>();
  const zeroDelayAdj = new Map<string, Set<string>>();

  for (const event of events) {
    const ctxLabel = `Event '${event.id}'`;

    if (event.character_id && !characters[event.character_id]) {
      errors.push(
        `${ctxLabel}: character_id '${event.character_id}' not found in content/characters/.`,
      );
    }

    if (event.illustration_id && manifest && !manifest.assets[event.illustration_id]) {
      errors.push(
        `${ctxLabel}: illustration_id '${event.illustration_id}' not found in assets/manifest.json.`,
      );
    }

    if (event.exclusive_with) {
      for (const exId of event.exclusive_with) {
        if (exId === event.id) {
          errors.push(`${ctxLabel}: exclusive_with cannot reference itself.`);
        } else if (!eventsById.has(exId)) {
          errors.push(`${ctxLabel}: exclusive_with references unknown event '${exId}'.`);
        }
      }
    }

    const eventHasNoEmployeeGuard = event.requirements?.has_employee === false;

    for (const choice of event.choices) {
      const choiceHasNoEmployeeGuard =
        eventHasNoEmployeeGuard || choice.requirements?.has_employee === false;
      const effectBlocks = collectChoiceEffectBlocks(choice);

      for (const { label, effects } of effectBlocks) {
        const fullLabel = `${ctxLabel} -> ${label}`;
        validateEffectsReferences(
          event.id,
          effects,
          choiceHasNoEmployeeGuard,
          fullLabel,
          eventsById,
          characters,
          incomingScheduledCount,
          zeroDelayAdj,
          errors,
        );
      }
    }
  }

  for (const event of events) {
    if (event.weight === 0 && (incomingScheduledCount.get(event.id) ?? 0) === 0) {
      errors.push(
        `Event '${event.id}' has weight: 0 (chain-only) but no incoming schedule_events reference (orphan event).`,
      );
    }
  }

  const cyclePath = detectZeroDelayCycle(events, zeroDelayAdj);
  if (cyclePath) {
    errors.push(`Detected delay_months: 0 schedule_events cycle: ${cyclePath.join(" -> ")}.`);
  }
}

function collectChoiceEffectBlocks(choice: ChoiceSpec): { label: string; effects: EffectsSpec }[] {
  const blocks: { label: string; effects: EffectsSpec }[] = [];
  if (choice.effects) {
    blocks.push({ label: `choice '${choice.id}'`, effects: choice.effects });
  }
  if (choice.outcomes) {
    for (const outcome of choice.outcomes) {
      blocks.push({
        label: `choice '${choice.id}' outcome '${outcome.id}'`,
        effects: outcome.effects,
      });
    }
  }
  return blocks;
}

function validateEffectsReferences(
  sourceEventId: string,
  effects: EffectsSpec,
  hasNoEmployeeGuard: boolean,
  fullLabel: string,
  eventsById: ReadonlyMap<string, EventDef>,
  characters: Readonly<Record<string, CharacterDef>>,
  incomingScheduledCount: Map<string, number>,
  zeroDelayAdj: Map<string, Set<string>>,
  errors: string[],
): void {
  if (effects.schedule_events) {
    for (const sched of effects.schedule_events) {
      if (!eventsById.has(sched.event_id)) {
        errors.push(`${fullLabel}: schedule_events references unknown event '${sched.event_id}'.`);
        continue;
      }
      const prob = sched.probability ?? 1;
      if (prob > 0 && sched.event_id !== sourceEventId) {
        incomingScheduledCount.set(
          sched.event_id,
          (incomingScheduledCount.get(sched.event_id) ?? 0) + 1,
        );
      }
      if (sched.delay_months === 0 && prob > 0) {
        let targets = zeroDelayAdj.get(sourceEventId);
        if (!targets) {
          targets = new Set<string>();
          zeroDelayAdj.set(sourceEventId, targets);
        }
        targets.add(sched.event_id);
      }
    }
  }

  if (effects.set_gestor) {
    const { tier, character_id } = effects.set_gestor;
    if (tier === "self" && character_id != null) {
      errors.push(`${fullLabel}: set_gestor with tier 'self' cannot specify character_id.`);
    } else if (tier !== "self" && character_id != null) {
      const gestorChar = characters[character_id];
      if (!gestorChar) {
        errors.push(`${fullLabel}: set_gestor references unknown character '${character_id}'.`);
      } else if (gestorChar.role !== "gestor" || !gestorChar.gestor_params) {
        errors.push(
          `${fullLabel}: set_gestor character '${character_id}' must have role 'gestor'.`,
        );
      } else if (gestorChar.gestor_params.tier !== tier) {
        errors.push(
          `${fullLabel}: set_gestor tier '${tier}' mismatches '${character_id}' tier '${gestorChar.gestor_params.tier}'.`,
        );
      }
    }
  }

  if (effects.set_family_status?.partner_character_id) {
    const partnerId = effects.set_family_status.partner_character_id;
    const partnerChar = characters[partnerId];
    if (!partnerChar) {
      errors.push(`${fullLabel}: set_family_status references unknown character '${partnerId}'.`);
    } else if (partnerChar.role !== "pareja") {
      errors.push(
        `${fullLabel}: set_family_status character '${partnerId}' must have role 'pareja'.`,
      );
    }
  }

  if (effects.hire_employee) {
    const empId = effects.hire_employee.character_id;
    const empChar = characters[empId];
    if (!empChar) {
      errors.push(`${fullLabel}: hire_employee references unknown character '${empId}'.`);
    } else if (empChar.role !== "empleado") {
      errors.push(`${fullLabel}: hire_employee character '${empId}' must have role 'empleado'.`);
    }
    if (!hasNoEmployeeGuard) {
      errors.push(
        `${fullLabel}: hire_employee requires 'has_employee: false' on either the event or choice requirements.`,
      );
    }
  }
}

function detectZeroDelayCycle(
  events: readonly EventDef[],
  adj: ReadonlyMap<string, ReadonlySet<string>>,
): string[] | null {
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, 1);
    stack.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        const nextState = color.get(next) ?? 0;
        if (nextState === 1) {
          const cycleStart = stack.indexOf(next);
          return [...stack.slice(cycleStart), next];
        }
        if (nextState === 0) {
          const found = dfs(next);
          if (found) {
            return found;
          }
        }
      }
    }

    stack.pop();
    color.set(node, 2);
    return null;
  }

  for (const event of events) {
    if ((color.get(event.id) ?? 0) === 0) {
      const cycle = dfs(event.id);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

function listYamlFiles(dirPath: string, relPrefix: string, errors: string[]): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (ext === ".yaml") {
      files.push(resolve(dirPath, entry.name));
    } else if (ext === ".yml") {
      errors.push(`${relPrefix}/${entry.name}: use '.yaml' extension instead of '.yml'.`);
    }
  }

  return files;
}

function safeParseYamlFile(filePath: string, errors: string[]): unknown {
  try {
    const rawText = readFileSync(filePath, "utf8");
    return parseYaml(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${filePath}: YAML parse error: ${message}`);
    return undefined;
  }
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  const result = loadAndValidateContent(process.cwd());
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`[validate:content] ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `[validate:content] Validated balance.yaml, ${Object.keys(result.characters).length} characters, and ${result.events.length} events.`,
  );
}
