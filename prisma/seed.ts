// izam TM — Database Seed Script
// Seeds: Roles, Allowed Domains, Lookup Categories & Values, Entity Field Configs

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Roles with permission sets ──
const ROLES = [
  {
    name: "Admin",
    permissions: {
      manageUsers: true,
      manageRoles: true,
      manageLookups: true,
      manageSchema: true,
      manageJira: true,
      manageAI: true,
      manageReports: true,
      viewAll: true,
      editAll: true,
      deleteAll: true,
      approveChanges: true,
      bypassApproval: true,
    },
  },
  {
    name: "QC Lead",
    permissions: {
      viewAll: true,
      editAll: true,
      deleteAll: true,
      approveChanges: true,
      bypassApproval: true,
      manageLookups: true,
      manageReports: true,
      runAIAnalysis: true,
    },
  },
  {
    name: "QC Engineer",
    permissions: {
      viewAll: true,
      editTestCases: true,
      editBugs: true,
      createTestCases: true,
      createBugs: true,
      runAIAnalysis: true,
      requiresApproval: true,
    },
  },
  {
    name: "Squad Member",
    permissions: {
      viewStories: true,
      viewTestCases: true,
      createBugs: true,
      editBugs: true,
      addComments: true,
      requiresApproval: true,
    },
  },
  {
    name: "Stakeholder",
    permissions: {
      viewDashboard: true,
      viewReports: true,
      addComments: true,
    },
  },
  {
    name: "Viewer",
    permissions: {
      viewDashboard: true,
      viewReports: true,
    },
  },
];

// ── Lookup categories with values and colors ──
const LOOKUPS: Record<string, { value: string; color: string }[]> = {
  "Business Priority": [
    { value: "High", color: "#EF4444" },
    { value: "Medium", color: "#F59E0B" },
    { value: "Low", color: "#22C55E" },
  ],
  "Change Type": [
    { value: "New Feature", color: "#3B82F6" },
    { value: "Enhancement", color: "#8B5CF6" },
    { value: "Fix", color: "#F59E0B" },
    { value: "Regulatory", color: "#EC4899" },
  ],
  "Business Impact": [
    { value: "High", color: "#EF4444" },
    { value: "Medium", color: "#F59E0B" },
    { value: "Low", color: "#22C55E" },
  ],
  "Risk Level": [
    { value: "High", color: "#EF4444" },
    { value: "Medium", color: "#F59E0B" },
    { value: "Low", color: "#22C55E" },
  ],
  "Story Status": [
    { value: "Backlog", color: "#6B7280" },
    { value: "In Progress", color: "#3B82F6" },
    { value: "Ready for Test", color: "#F59E0B" },
    { value: "Done", color: "#22C55E" },
  ],
  "QC Status": [
    { value: "Not Started", color: "#6B7280" },
    { value: "In Progress", color: "#3B82F6" },
    { value: "Passed", color: "#22C55E" },
    { value: "Failed", color: "#EF4444" },
    { value: "Blocked", color: "#F59E0B" },
  ],
  "Test Level": [
    { value: "API", color: "#8B5CF6" },
    { value: "UI", color: "#3B82F6" },
    { value: "Integration", color: "#06B6D4" },
    { value: "E2E", color: "#10B981" },
  ],
  "Test Type": [
    { value: "Functional", color: "#3B82F6" },
    { value: "Regression", color: "#8B5CF6" },
    { value: "Integration", color: "#06B6D4" },
    { value: "UAT Support", color: "#F59E0B" },
  ],
  "Scenario Classification": [
    { value: "Happy", color: "#22C55E" },
    { value: "Negative", color: "#EF4444" },
    { value: "Edge", color: "#F59E0B" },
  ],
  Priority: [
    { value: "Critical", color: "#DC2626" },
    { value: "High", color: "#EF4444" },
    { value: "Medium", color: "#F59E0B" },
    { value: "Low", color: "#22C55E" },
  ],
  "Automation Status": [
    { value: "Automated", color: "#22C55E" },
    { value: "Manual", color: "#6B7280" },
    { value: "Planned", color: "#3B82F6" },
    { value: "N/A", color: "#9CA3AF" },
  ],
  "Execution Status": [
    { value: "Not Run", color: "#6B7280" },
    { value: "Passed", color: "#22C55E" },
    { value: "Failed", color: "#EF4444" },
    { value: "Blocked", color: "#F59E0B" },
  ],
  "Requirement Coverage Status": [
    { value: "Fully Covered", color: "#22C55E" },
    { value: "Partially Covered", color: "#F59E0B" },
    { value: "Not Covered", color: "#EF4444" },
  ],
  Severity: [
    { value: "Critical", color: "#DC2626" },
    { value: "High", color: "#EF4444" },
    { value: "Medium", color: "#F59E0B" },
    { value: "Low", color: "#22C55E" },
  ],
  Environment: [
    { value: "Production", color: "#EF4444" },
    { value: "UAT", color: "#F59E0B" },
    { value: "Staging", color: "#3B82F6" },
  ],
  "Defect Leakage Phase": [
    { value: "SIT", color: "#3B82F6" },
    { value: "UAT", color: "#F59E0B" },
    { value: "Production", color: "#EF4444" },
  ],
  "Root Cause Category": [
    { value: "Requirement Gap", color: "#8B5CF6" },
    { value: "Test Coverage Gap", color: "#EF4444" },
    { value: "Implementation Defect", color: "#F59E0B" },
    { value: "Environment Issue", color: "#06B6D4" },
    { value: "Data Issue", color: "#EC4899" },
  ],
  "Bug Status": [
    { value: "Open", color: "#EF4444" },
    { value: "In Progress", color: "#3B82F6" },
    { value: "Closed", color: "#22C55E" },
    { value: "Deferred", color: "#6B7280" },
  ],
};

// ── Entity Field Configurations (default seeded fields) ──
interface FieldConfig {
  entityType: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  lookupCategory?: string;
  isRequired: boolean;
  sortOrder: number;
}

const ENTITY_FIELDS: FieldConfig[] = [
  // Epic fields
  { entityType: "epic", fieldKey: "epic_id", fieldLabel: "Epic ID", fieldType: "text", isRequired: true, sortOrder: 1 },
  { entityType: "epic", fieldKey: "epic_title", fieldLabel: "Epic Title", fieldType: "text", isRequired: true, sortOrder: 2 },
  { entityType: "epic", fieldKey: "owner_id", fieldLabel: "Owner", fieldType: "user-select", isRequired: false, sortOrder: 3 },

  // User Story fields
  { entityType: "user_story", fieldKey: "story_id", fieldLabel: "User Story ID", fieldType: "text", isRequired: true, sortOrder: 1 },
  { entityType: "user_story", fieldKey: "story_title", fieldLabel: "User Story Title", fieldType: "text", isRequired: true, sortOrder: 2 },
  { entityType: "user_story", fieldKey: "requester_id", fieldLabel: "Requester", fieldType: "user-select", isRequired: false, sortOrder: 3 },
  { entityType: "user_story", fieldKey: "reason_for_request", fieldLabel: "Reason for Request", fieldType: "rich-text", isRequired: false, sortOrder: 4 },
  { entityType: "user_story", fieldKey: "business_priority", fieldLabel: "Business Priority", fieldType: "lookup", lookupCategory: "Business Priority", isRequired: false, sortOrder: 5 },
  { entityType: "user_story", fieldKey: "change_type", fieldLabel: "Change Type", fieldType: "lookup", lookupCategory: "Change Type", isRequired: false, sortOrder: 6 },
  { entityType: "user_story", fieldKey: "business_impact", fieldLabel: "Business Impact", fieldType: "lookup", lookupCategory: "Business Impact", isRequired: false, sortOrder: 7 },
  { entityType: "user_story", fieldKey: "risk_level", fieldLabel: "Risk Level", fieldType: "lookup", lookupCategory: "Risk Level", isRequired: false, sortOrder: 8 },
  { entityType: "user_story", fieldKey: "module_feature", fieldLabel: "Module / Feature", fieldType: "text", isRequired: false, sortOrder: 9 },
  { entityType: "user_story", fieldKey: "implementation_sprint", fieldLabel: "Implementation Sprint", fieldType: "text", isRequired: false, sortOrder: 10 },
  { entityType: "user_story", fieldKey: "sprint_start_date", fieldLabel: "Sprint Start Date", fieldType: "date", isRequired: false, sortOrder: 11 },
  { entityType: "user_story", fieldKey: "sprint_end_date", fieldLabel: "Sprint End Date", fieldType: "date", isRequired: false, sortOrder: 12 },
  { entityType: "user_story", fieldKey: "release_version", fieldLabel: "Release Version", fieldType: "text", isRequired: false, sortOrder: 13 },
  { entityType: "user_story", fieldKey: "deployment_date", fieldLabel: "Deployment Date", fieldType: "date", isRequired: false, sortOrder: 14 },
  { entityType: "user_story", fieldKey: "story_status", fieldLabel: "Story Status", fieldType: "lookup", lookupCategory: "Story Status", isRequired: false, sortOrder: 15 },
  { entityType: "user_story", fieldKey: "qc_status", fieldLabel: "QC Status", fieldType: "lookup", lookupCategory: "QC Status", isRequired: false, sortOrder: 16 },
  { entityType: "user_story", fieldKey: "owner_id", fieldLabel: "Owner", fieldType: "user-select", isRequired: false, sortOrder: 17 },
  { entityType: "user_story", fieldKey: "notes", fieldLabel: "Notes", fieldType: "rich-text", isRequired: false, sortOrder: 18 },

  // Test Case fields
  { entityType: "test_case", fieldKey: "test_case_id", fieldLabel: "Test Case ID", fieldType: "text", isRequired: true, sortOrder: 1 },
  { entityType: "test_case", fieldKey: "story_id", fieldLabel: "User Story ID", fieldType: "relation", isRequired: false, sortOrder: 2 },
  { entityType: "test_case", fieldKey: "story_section_id", fieldLabel: "Story Section", fieldType: "relation", isRequired: false, sortOrder: 3 },
  { entityType: "test_case", fieldKey: "requirement_ref", fieldLabel: "Requirement Ref", fieldType: "text", isRequired: false, sortOrder: 4 },
  { entityType: "test_case", fieldKey: "test_case_title", fieldLabel: "Test Case Title", fieldType: "text", isRequired: true, sortOrder: 5 },
  { entityType: "test_case", fieldKey: "test_level", fieldLabel: "Test Level", fieldType: "lookup", lookupCategory: "Test Level", isRequired: false, sortOrder: 6 },
  { entityType: "test_case", fieldKey: "test_type", fieldLabel: "Test Type", fieldType: "lookup", lookupCategory: "Test Type", isRequired: false, sortOrder: 7 },
  { entityType: "test_case", fieldKey: "scenario_classification", fieldLabel: "Scenario Classification", fieldType: "lookup", lookupCategory: "Scenario Classification", isRequired: false, sortOrder: 8 },
  { entityType: "test_case", fieldKey: "priority", fieldLabel: "Priority", fieldType: "lookup", lookupCategory: "Priority", isRequired: false, sortOrder: 9 },
  { entityType: "test_case", fieldKey: "automation_status", fieldLabel: "Automation Status", fieldType: "lookup", lookupCategory: "Automation Status", isRequired: false, sortOrder: 10 },
  { entityType: "test_case", fieldKey: "reviewer_id", fieldLabel: "Reviewer Name", fieldType: "user-select", isRequired: false, sortOrder: 11 },
  { entityType: "test_case", fieldKey: "test_data_reference", fieldLabel: "Test Data Reference", fieldType: "text", isRequired: false, sortOrder: 12 },
  { entityType: "test_case", fieldKey: "execution_cycle", fieldLabel: "Execution Cycle", fieldType: "text", isRequired: false, sortOrder: 13 },
  { entityType: "test_case", fieldKey: "execution_status", fieldLabel: "Execution Status", fieldType: "lookup", lookupCategory: "Execution Status", isRequired: false, sortOrder: 14 },
  { entityType: "test_case", fieldKey: "requirement_coverage", fieldLabel: "Requirement Coverage Status", fieldType: "lookup", lookupCategory: "Requirement Coverage Status", isRequired: false, sortOrder: 15 },
  { entityType: "test_case", fieldKey: "comments", fieldLabel: "Comments", fieldType: "rich-text", isRequired: false, sortOrder: 16 },

  // Production Bug fields
  { entityType: "production_bug", fieldKey: "bug_id", fieldLabel: "Production Bug ID", fieldType: "text", isRequired: true, sortOrder: 1 },
  { entityType: "production_bug", fieldKey: "bug_title", fieldLabel: "Bug Title", fieldType: "text", isRequired: true, sortOrder: 2 },
  { entityType: "production_bug", fieldKey: "reported_date", fieldLabel: "Reported Date", fieldType: "date", isRequired: false, sortOrder: 3 },
  { entityType: "production_bug", fieldKey: "reported_by_id", fieldLabel: "Reported By", fieldType: "user-select", isRequired: false, sortOrder: 4 },
  { entityType: "production_bug", fieldKey: "severity", fieldLabel: "Severity", fieldType: "lookup", lookupCategory: "Severity", isRequired: false, sortOrder: 5 },
  { entityType: "production_bug", fieldKey: "priority", fieldLabel: "Priority", fieldType: "lookup", lookupCategory: "Priority", isRequired: false, sortOrder: 6 },
  { entityType: "production_bug", fieldKey: "environment", fieldLabel: "Environment", fieldType: "lookup", lookupCategory: "Environment", isRequired: false, sortOrder: 7 },
  { entityType: "production_bug", fieldKey: "linked_epic_id", fieldLabel: "Linked Epic ID", fieldType: "relation", isRequired: false, sortOrder: 8 },
  { entityType: "production_bug", fieldKey: "linked_story_id", fieldLabel: "Linked User Story ID", fieldType: "relation", isRequired: false, sortOrder: 9 },
  { entityType: "production_bug", fieldKey: "release_version", fieldLabel: "Related Release Version", fieldType: "text", isRequired: false, sortOrder: 10 },
  { entityType: "production_bug", fieldKey: "defect_leakage_phase", fieldLabel: "Defect Leakage Phase", fieldType: "lookup", lookupCategory: "Defect Leakage Phase", isRequired: false, sortOrder: 11 },
  { entityType: "production_bug", fieldKey: "root_cause_category", fieldLabel: "Root Cause Category", fieldType: "lookup", lookupCategory: "Root Cause Category", isRequired: false, sortOrder: 12 },
  { entityType: "production_bug", fieldKey: "requirement_gap", fieldLabel: "Requirement Gap?", fieldType: "boolean", isRequired: false, sortOrder: 13 },
  { entityType: "production_bug", fieldKey: "test_coverage_gap", fieldLabel: "Test Coverage Gap?", fieldType: "boolean", isRequired: false, sortOrder: 14 },
  { entityType: "production_bug", fieldKey: "existing_test_case_id", fieldLabel: "Existing Test Case ID", fieldType: "relation", isRequired: false, sortOrder: 15 },
  { entityType: "production_bug", fieldKey: "new_test_case_needed", fieldLabel: "New Test Case Needed?", fieldType: "boolean", isRequired: false, sortOrder: 16 },
  { entityType: "production_bug", fieldKey: "rca_summary", fieldLabel: "RCA Summary", fieldType: "rich-text", isRequired: false, sortOrder: 17 },
  { entityType: "production_bug", fieldKey: "preventive_action", fieldLabel: "Preventive Action", fieldType: "rich-text", isRequired: false, sortOrder: 18 },
  { entityType: "production_bug", fieldKey: "regression_pack_updated", fieldLabel: "Regression Pack Updated?", fieldType: "boolean", isRequired: false, sortOrder: 19 },
  { entityType: "production_bug", fieldKey: "bug_status", fieldLabel: "Bug Status", fieldType: "lookup", lookupCategory: "Bug Status", isRequired: false, sortOrder: 20 },
];

async function main() {
  console.log("🌱 Seeding izam TM database...\n");

  // ── 1. Seed Roles ──
  console.log("📋 Creating roles...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
    console.log(`   ✓ ${role.name}`);
  }

  // ── 2. Seed Allowed Domains ──
  console.log("\n🌐 Setting allowed domains...");
  await prisma.allowedDomain.upsert({
    where: { domain: "izam.co" },
    update: {},
    create: { domain: "izam.co", isActive: true },
  });
  console.log("   ✓ izam.co");

  // ── 3. Seed Lookup Categories & Values ──
  console.log("\n📂 Creating lookup categories & values...");
  const categoryMap: Record<string, string> = {};

  for (const [categoryName, values] of Object.entries(LOOKUPS)) {
    const category = await prisma.lookupCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: {
        name: categoryName,
        description: `${categoryName} lookup values`,
        isSystem: true,
      },
    });
    categoryMap[categoryName] = category.id;

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      await prisma.lookupValue.upsert({
        where: {
          categoryId_value: {
            categoryId: category.id,
            value: v.value,
          },
        },
        update: { color: v.color, sortOrder: i },
        create: {
          categoryId: category.id,
          value: v.value,
          color: v.color,
          sortOrder: i,
          isActive: true,
          isDefault: i === 0,
        },
      });
    }
    console.log(`   ✓ ${categoryName} (${values.length} values)`);
  }

  // ── 4. Seed Entity Field Configs ──
  console.log("\n⚙️  Creating entity field configurations...");
  let fieldCount = 0;
  for (const field of ENTITY_FIELDS) {
    const lookupCategoryId = field.lookupCategory
      ? categoryMap[field.lookupCategory] || null
      : null;

    await prisma.entityFieldConfig.upsert({
      where: {
        entityType_fieldKey: {
          entityType: field.entityType,
          fieldKey: field.fieldKey,
        },
      },
      update: {
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        lookupCategoryId,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
      },
      create: {
        entityType: field.entityType,
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        lookupCategoryId,
        isRequired: field.isRequired,
        isVisible: true,
        sortOrder: field.sortOrder,
      },
    });
    fieldCount++;
  }
  console.log(`   ✓ ${fieldCount} field configs across 4 entity types`);

  console.log("\n✅ Seed complete!\n");
  console.log("Summary:");
  console.log(`  • ${ROLES.length} roles`);
  console.log(`  • 1 allowed domain`);
  console.log(`  • ${Object.keys(LOOKUPS).length} lookup categories`);
  console.log(
    `  • ${Object.values(LOOKUPS).reduce((sum, v) => sum + v.length, 0)} lookup values`
  );
  console.log(`  • ${fieldCount} entity field configs`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
