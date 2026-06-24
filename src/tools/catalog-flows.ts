import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { writeCatalog } from '../qa/catalog'

/**
 * `catalog_flows` — the LEAD writes the discovered user flows to e2e/specs/<slug>.md.
 * The catalog is the backlog the drivers turn into specs, and a review artifact.
 */
export const createCatalogFlowsTool = (cfg: QaConfig) =>
  defineTool({
    name: 'catalog_flows',
    description:
      'Persist the discovered user flows as e2e/specs/<slug>.md (steps + expected outcomes). ' +
      'The catalog is the backlog the drivers turn into Playwright specs, and a review artifact.',
    parameters: v.object({
      flows: v.array(
        v.object({
          slug: v.pipe(
            v.string(),
            v.minLength(1),
            v.description('kebab-case → spec file name')
          ),
          title: v.string(),
          priority: v.picklist(['high', 'medium', 'low']),
          entryUrl: v.optional(v.string()),
          needs: v.array(v.picklist(['browser', 'api', 'auth', 'billing'])),
          steps: v.array(v.string()),
          expected: v.array(v.string()),
        })
      ),
    }),
    execute: async ({ flows }) => writeCatalog(cfg.workspace, flows),
  })
