/**
 * @recursivemanager/cli
 *
 * Command-line interface for RecursiveManager.
 * This package provides the user-facing CLI tool for all agent operations.
 */

export const VERSION = '1.1.12';

// Org chart visualization utilities (Phase 2.2.20)
export {
  formatOrgChart,
  formatAsTree,
  formatAsIndented,
  formatAsTable,
  formatAsJSON,
  displayOrgChart,
  type OrgChartEntry,
  type FormatOptions,
} from './utils/formatOrgChart';

// Placeholder - additional exports will be added in Phase 6
export {};
