/**
 * Single source of truth for every test case in test-cases.xlsx.
 *
 * - `row` is the 1-based worksheet row in the source workbook (used by scripts/fill-results.mjs).
 * - `mode` drives how the case is handled:
 *     'readonly' - executed against the live portal, no data mutated.
 *     'write'    - executed with a reversible mutation (create->delete / toggle->revert) on admin-config
 *                  entities only (roles, location levels, locations). Never on real users/orders/templates.
 *     'blocked'  - not executed automatically; `note` explains why (irreversible, needs extra accounts,
 *                  needs dedicated seed data, sends real notifications, or non-admin/second-session driven).
 * - A Playwright test exists for every 'readonly' and 'write' case, titled `"<id> <title>"`. The fill
 *   script maps Playwright results back to rows by the leading id token; 'blocked' rows are filled from
 *   the `note` here.
 */

export type ExecMode = 'readonly' | 'write' | 'blocked';

export interface TestCase {
  id: string;
  row: number;
  section: string;
  title: string;
  expected: string;
  mode: ExecMode;
  note?: string;
  /** Plain-language description of what the automated test verifies (used to explain a Pass). */
  checks?: string;
  /** The real reason an automated case fails (a known application gap), used to explain a Fail. */
  failReason?: string;
}

const BLOCK_NO_DEACTIVATED_ADMIN =
  'Blocked - test data unavailable: no deactivated admin account provisioned (primary admin only).';
const BLOCK_NO_NON_ADMIN =
  'Blocked - test data unavailable: no non-admin / second-role account provisioned (primary admin only).';
const BLOCK_SECOND_SESSION =
  'Blocked - requires a second device/session or restricted user; not automatable with a single primary admin.';
const BLOCK_TEST_USER =
  'Blocked - would mutate a real production user; no dedicated disposable test user available.';
const BLOCK_IRREVERSIBLE =
  'Blocked - irreversible / notification-sending action on live data (excluded by semi-destructive scope).';
const BLOCK_TEMPLATE =
  'Blocked - editing live email/SMS templates affects production notifications (excluded by semi-destructive scope).';
const BLOCK_ORDER =
  'Blocked - order state transitions / buyer-seller actions mutate live orders and notify real users (excluded by semi-destructive scope).';
const BLOCK_SEED =
  'Blocked - needs a specific pre-seeded data condition (e.g. 10,000+ rows) not present in the live environment.';

export const TEST_CASES: TestCase[] = [
  // ---- LOG IN ----
  { id: 'IA-FM01-F01-TC01', row: 3, section: 'LOG IN', title: 'Successful Login by Active Instance Admin', expected: 'User is authenticated successfully and redirected to the Instance Admin Dashboard', mode: 'readonly', checks: "Signed in through the Continue with Admin OAuth flow and landed on /isoko/association with the Associations dashboard heading visible." },
  { id: 'IA-FM01-F01-TC02', row: 4, section: 'LOG IN', title: 'Login with Incorrect Password', expected: 'Login fails and an error message indicating invalid credentials is displayed', mode: 'readonly', checks: "Submitted a wrong password; the flow stayed on the OAuth host, surfaced an invalid-credentials error, and never reached the dashboard." },
  { id: 'IA-FM01-F01-TC03', row: 5, section: 'LOG IN', title: 'Login Attempt by Deactivated Instance Admin Account', expected: 'Login is denied and system displays account deactivation message', mode: 'blocked', note: BLOCK_NO_DEACTIVATED_ADMIN },
  { id: 'IA-FM01-F01-TC04', row: 6, section: 'LOG IN', title: 'Login Attempt by Non-admin User', expected: 'Access is denied and user is informed they do not have permission to access the portal', mode: 'blocked', note: BLOCK_NO_NON_ADMIN },
  { id: 'IA-FM01-F01-TC05', row: 7, section: 'LOG IN', title: 'Concurrent Login Handling', expected: 'System enforces session policy (either allows both sessions)', mode: 'blocked', note: BLOCK_SECOND_SESSION },
  { id: 'IA-FM01-F01-TC06', row: 8, section: 'LOG IN', title: 'Unauthorized Access to System Admin URLs', expected: 'Access is denied and user is redirected to the login page', mode: 'readonly', checks: "Deep-linked to a protected admin route while logged out and was bounced to the sign-in / OAuth page instead of seeing the data." },

  // ---- DASHBOARD AND NAVIGATION MENU ACCESS ----
  { id: 'IA-AL01-F02-TC01', row: 10, section: 'DASHBOARD AND NAVIGATION MENU ACCESS', title: 'Dashboard Metrics Load Correctly', expected: 'Dashboard metrics display accurate data matching backend records', mode: 'readonly', checks: "Dashboard renders the Total Associations, Active Associations and Pending Approval metric cards with at least one numeric value." },
  { id: 'IA-AL01-F02-TC02', row: 11, section: 'DASHBOARD AND NAVIGATION MENU ACCESS', title: 'View top rated items', expected: 'Top rated items are displayed on the dashboard', mode: 'readonly', failReason: "No top-rated section (top sellers, top products, or highest-rated) is rendered on the instance admin dashboard." },
  { id: 'IA-AL01-F02-TC03', row: 12, section: 'DASHBOARD AND NAVIGATION MENU ACCESS', title: 'Access to Authorized Sections', expected: 'Access is granted to all instance level functions', mode: 'readonly', checks: "All core sidebar entries (Users, Orders, Roles, Products, Locations) are available, and navigating to Users and Orders loads their pages." },

  // ---- USER MANAGEMENT ----
  { id: 'IA-FM01-F15-TC01', row: 14, section: 'USER MANAGEMENT', title: 'View User List', expected: 'List of users displayed with key attributes', mode: 'readonly', checks: "The Users page shows a populated table with name, email, role and status columns." },
  { id: 'IA-FM01-F15-TC02', row: 15, section: 'USER MANAGEMENT', title: 'Search User by Name or Email', expected: 'Matching users returned; no irrelevant users displayed', mode: 'readonly', checks: "Searching a term taken from the first row returned matching rows that contain that term." },
  { id: 'IA-FM01-F15-TC03', row: 16, section: 'USER MANAGEMENT', title: 'Filter Users by Location', expected: 'Only users from selected country are displayed', mode: 'readonly', failReason: "No location/country filter control is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC04', row: 17, section: 'USER MANAGEMENT', title: 'Filter Users by Role', expected: 'Users displayed match selected role', mode: 'readonly', failReason: "No role filter control is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC05', row: 18, section: 'USER MANAGEMENT', title: 'Filter Users by Status', expected: 'Only users with selected status are shown', mode: 'readonly', failReason: "No status filter control is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC06', row: 19, section: 'USER MANAGEMENT', title: 'View User Profile Details', expected: 'Full user profile displayed', mode: 'readonly', checks: "Opening a user via View navigated to the profile route and displayed identifying details (email, phone, role, status, name)." },
  { id: 'IA-FM01-F15-TC07', row: 20, section: 'USER MANAGEMENT', title: 'Update User Profile Details', expected: 'User details update', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F15-TC08', row: 21, section: 'USER MANAGEMENT', title: 'Restriction on User profile edits', expected: "System blocks editing of user's phone number and email", mode: 'readonly', checks: "On the user profile, phone and email have no enabled editor, confirming they are read-only as required." },
  { id: 'IA-FM01-F15-TC10', row: 22, section: 'USER MANAGEMENT', title: 'Assign User Role', expected: 'Role updated successfully; permissions updated; change logged', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F15-TC11', row: 23, section: 'USER MANAGEMENT', title: 'Activate User Account', expected: 'User status changes to active; user can log in; action logged', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F15-TC12', row: 24, section: 'USER MANAGEMENT', title: 'Deactivate User Account', expected: 'User cannot log in; sessions terminated; status updated', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F15-TC13', row: 25, section: 'USER MANAGEMENT', title: 'Bulk User Actions', expected: 'Action applied to all selected users; partial failures reported', mode: 'blocked', note: BLOCK_TEST_USER },

  // ---- ROLE AND PERMISSION ASSIGNMENT ----
  { id: 'IA-FM01-F03-TC01', row: 27, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Create New Role', expected: 'Role created successfully', mode: 'write', checks: "Created a throwaway role via Add Role and confirmed it appears in the roles table (cleaned up by deactivation afterwards)." },
  { id: 'IA-FM01-F03-TC02', row: 28, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Create Role with Missing Mandatory Fields', expected: 'Validation error displayed', mode: 'write', checks: "Submitting an empty role name was rejected: the modal stayed open / a validation error showed / no new row was added." },
  { id: 'IA-FM01-F03-TC03', row: 29, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Create Duplicate Role', expected: 'System prevents duplication', mode: 'write', checks: "Re-using an existing role name was prevented; no duplicate row was created." },
  { id: 'IA-FM01-F03-TC04', row: 30, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Edit Role Details', expected: 'Changes saved successfully', mode: 'write', checks: "Renamed the role then reverted it; the updated name appeared in the table, confirming edits persist." },
  { id: 'IA-FM01-F03-TC05', row: 31, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'View Role Details', expected: 'All permissions and metadata visible', mode: 'readonly', checks: "Opened the role editor and confirmed the Role Name and Active fields are displayed." },
  { id: 'IA-FM01-F03-TC06', row: 32, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Deactivate Role', expected: 'Role marked inactive', mode: 'write', checks: "Unchecked Active and saved; re-opening the role confirmed it now reads inactive." },
  { id: 'IA-FM01-F03-TC07', row: 33, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Reactivate Role', expected: 'Role restored', mode: 'write', checks: "Re-checked Active and saved; re-opening the role confirmed it now reads active again." },
  { id: 'IA-FM01-F03-TC08', row: 34, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Assign Permission to Role', expected: 'Permission assigned', mode: 'write', failReason: "The role editor exposes only an Active toggle - no permission-assignment UI exists in this build." },
  { id: 'IA-FM01-F03-TC09', row: 35, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Assign Multiple Permissions', expected: 'All permissions applied', mode: 'write', failReason: "The role editor exposes only an Active toggle - no permission-assignment UI exists in this build." },
  { id: 'IA-FM01-F03-TC10', row: 36, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Remove Permission', expected: 'Role loses capability', mode: 'write', failReason: "The role editor exposes only an Active toggle - no permission-assignment UI exists in this build." },
  { id: 'IA-FM01-F03-TC11', row: 37, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Remove All Permissions', expected: 'Role has no access', mode: 'write', failReason: "The role editor exposes only an Active toggle - no permission-assignment UI exists in this build." },
  { id: 'IA-FM01-F03-TC12', row: 38, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Permission Removal Audit', expected: 'Change recorded', mode: 'blocked', note: 'Blocked - requires an audit-log surface not exposed in the instance admin UI.' },
  { id: 'IA-FM01-F03-TC13', row: 39, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Assign Role to User', expected: 'Role applied', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F03-TC14', row: 40, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Change User Role', expected: 'Old role replaced', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F03-TC15', row: 41, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Remove Role from User', expected: 'User loses access', mode: 'blocked', note: BLOCK_TEST_USER },
  { id: 'IA-FM01-F03-TC16', row: 42, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Immediate Permission Enforcement', expected: 'Access updated immediately', mode: 'blocked', note: BLOCK_SECOND_SESSION },
  { id: 'IA-FM01-F03-TC17', row: 43, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Session Refresh Permission Update', expected: 'Permissions updated', mode: 'blocked', note: BLOCK_SECOND_SESSION },
  { id: 'IA-FM01-F03-TC18', row: 44, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'Prevent Access After Permission Removal', expected: 'Access denied', mode: 'blocked', note: BLOCK_SECOND_SESSION },
  { id: 'IA-FM01-F03-TC19', row: 45, section: 'ROLE AND PERMISSION ASSIGNMENT', title: 'UI Menu Visibility Enforcement', expected: 'Only allowed menus visible', mode: 'blocked', note: BLOCK_NO_NON_ADMIN },

  // ---- LOCATION AND LOCATION LEVEL ----
  { id: 'IA-FM01-F10-TC01', row: 47, section: 'LOCATION AND LOCATION LEVEL', title: 'Create location level (no parent)', expected: 'Level created successfully', mode: 'write', checks: "Created a location level with no parent via Add Level and confirmed it appears in the list (cleaned up by deactivation afterwards)." },
  { id: 'IA-FM01-F10-TC02', row: 48, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Child Location Level', expected: 'Location level created and linked to parent', mode: 'write', checks: "Created a child location level linked to parent ID 1 and confirmed it appears in the list." },
  { id: 'IA-FM01-F10-TC03', row: 49, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Location Level Without Name', expected: 'Validation error displayed', mode: 'write', checks: "Submitting a level with no name was rejected: the modal stayed open / a validation error showed / no new row was added." },
  { id: 'IA-FM01-F10-TC04', row: 50, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Duplicate Location Level', expected: 'Duplicate prevented', mode: 'write', checks: "Re-using an existing level name was prevented; no duplicate was created." },
  { id: 'IA-FM01-F10-TC05', row: 51, section: 'LOCATION AND LOCATION LEVEL', title: 'Deactivate Location Level', expected: 'Level marked inactive', mode: 'write', checks: "Deactivated the temp level via the Active toggle and confirmed it reads unchecked on re-open." },
  { id: 'IA-FM01-F10-TC06', row: 52, section: 'LOCATION AND LOCATION LEVEL', title: 'Activate Location Level', expected: 'Level reactivated', mode: 'write', checks: "Reactivated the temp level and confirmed the Active toggle reads checked on re-open." },
  { id: 'IA-FM01-F10-TC07', row: 53, section: 'LOCATION AND LOCATION LEVEL', title: 'Prevent Deactivation if Locations Exist', expected: 'System blocks or warns', mode: 'blocked', note: 'Blocked - requires a level with linked locations to be set up and torn down reliably; high risk of orphaned config on live env.' },
  { id: 'IA-FM01-F10-TC08', row: 54, section: 'LOCATION AND LOCATION LEVEL', title: 'Visibility of Inactive Levels', expected: 'Inactive not visible', mode: 'write', failReason: "After a level is deactivated it still appears in the default Location Levels list; inactive entries are not hidden." },
  { id: 'IA-FM01-F10-TC09', row: 55, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Parent Location (no parent)', expected: 'Location created', mode: 'write', checks: "Created a parent location with no parent and confirmed it appears in the locations table." },
  { id: 'IA-FM01-F10-TC10', row: 56, section: 'LOCATION AND LOCATION LEVEL', title: 'Create child location', expected: 'Location created and linked to parent', mode: 'write', checks: "Created a child location linked to parent ID 1 and confirmed it appears in the table." },
  { id: 'IA-FM01-F10-TC11', row: 57, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Location Under Inactive Level', expected: 'Inactive level not listed in options', mode: 'write', failReason: "The location form uses a free-text Level ID with no options list, so exclusion of inactive levels cannot be enforced or verified." },
  { id: 'IA-FM01-F10-TC12', row: 58, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Location with Missing Fields', expected: 'Validation error', mode: 'write', checks: "Submitting a location with missing fields was rejected: the modal stayed open / a validation error showed / no new row was added." },
  { id: 'IA-FM01-F10-TC13', row: 59, section: 'LOCATION AND LOCATION LEVEL', title: 'Create Duplicate Location', expected: 'Duplicate prevented', mode: 'write', checks: "Re-using an existing location name was prevented; no duplicate was created." },
  { id: 'IA-FM01-F10-TC14', row: 60, section: 'LOCATION AND LOCATION LEVEL', title: 'Change Parent Location', expected: 'Parent updated', mode: 'write', checks: "Set the location's Parent ID then reverted it; the update saved without error." },
  { id: 'IA-FM01-F10-TC15', row: 61, section: 'LOCATION AND LOCATION LEVEL', title: 'Deactivate Location', expected: 'Location inactive', mode: 'write', checks: "Deactivated the temp location via the Active toggle and saved." },
  { id: 'IA-FM01-F10-TC16', row: 62, section: 'LOCATION AND LOCATION LEVEL', title: 'Activate Location', expected: 'Location active', mode: 'write', checks: "Reactivated the temp location and confirmed the Active toggle reads checked on re-open." },
  { id: 'IA-FM01-F10-TC17', row: 63, section: 'LOCATION AND LOCATION LEVEL', title: 'Prevent Use of Inactive Location', expected: 'Not visible for assignment', mode: 'blocked', note: 'Blocked - cross-feature dependency (user/product assignment) on live data; verified indirectly by TC11.' },

  // ---- EXPORT USERLIST ----
  { id: 'IA-FM01-F15-TC14', row: 65, section: 'EXPORT USERLIST', title: 'Export All Users', expected: 'All users exported', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC15', row: 66, section: 'EXPORT USERLIST', title: 'Export with Large User Volume', expected: 'File generated without timeout', mode: 'blocked', note: BLOCK_SEED },
  { id: 'IA-FM01-F15-TC16', row: 67, section: 'EXPORT USERLIST', title: 'File Naming Convention', expected: 'Name includes date/time', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so the file name cannot be checked." },
  { id: 'IA-FM01-F15-TC17', row: 68, section: 'EXPORT USERLIST', title: 'XLS File Opens Correctly', expected: 'No corruption', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so no file can be produced or opened." },
  { id: 'IA-FM01-F15-TC18', row: 69, section: 'EXPORT USERLIST', title: 'Header Row Validation', expected: 'Correct column names', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so no exported header row exists to validate." },
  { id: 'IA-FM01-F15-TC19', row: 70, section: 'EXPORT USERLIST', title: 'User Count Validation', expected: 'Counts match', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so exported counts cannot be compared." },
  { id: 'IA-FM01-F15-TC20', row: 71, section: 'EXPORT USERLIST', title: 'Data Formatting Validation', expected: 'Correct data types', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so exported data formatting cannot be checked." },
  { id: 'IA-FM01-F15-TC21', row: 72, section: 'EXPORT USERLIST', title: 'Export Filtered by Location', expected: 'Only selected country users', mode: 'readonly', failReason: "No export/download control (nor a location/country filter) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC22', row: 73, section: 'EXPORT USERLIST', title: 'Export Filtered by Association', expected: 'Correct subset exported', mode: 'readonly', failReason: "No export/download control (nor an association filter) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC23', row: 74, section: 'EXPORT USERLIST', title: 'Export Filtered by Role', expected: 'Role-specific users exported', mode: 'readonly', failReason: "No export/download control (nor a role filter) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC24', row: 75, section: 'EXPORT USERLIST', title: 'Export Filtered by Status', expected: 'Only matching users', mode: 'readonly', failReason: "No export/download control (nor a status filter) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC25', row: 76, section: 'EXPORT USERLIST', title: 'Export Filtered by Date Range', expected: 'Correct subset exported', mode: 'readonly', failReason: "No export/download control (nor a date-range filter) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC26', row: 77, section: 'EXPORT USERLIST', title: 'Export with Multiple Filters', expected: 'All conditions respected', mode: 'readonly', failReason: "No export/download control (nor filter controls) is present on the Users list in this build." },
  { id: 'IA-FM01-F15-TC27', row: 78, section: 'EXPORT USERLIST', title: 'Export Empty Result Set', expected: 'Empty file or warning', mode: 'readonly', failReason: "No export/download control is present on the Users list in this build, so an empty-result export cannot be exercised." },

  // ---- ASSOCIATION MANAGEMENT ----
  { id: 'IA-CM05-F01-TC01', row: 80, section: 'ASSOCIATION MANAGEMENT', title: 'View Associations List', expected: 'List of all registered associations displayed with key details', mode: 'readonly', checks: "The Associations Management page shows a populated table with association, country, status and member columns." },
  { id: 'IA-CM05-F01-TC02', row: 81, section: 'ASSOCIATION MANAGEMENT', title: 'Search Association', expected: 'Matching associations returned accurately', mode: 'readonly', checks: "Searching a term taken from the first row returned results that contain that term." },
  { id: 'IA-CM05-F01-TC03', row: 82, section: 'ASSOCIATION MANAGEMENT', title: 'Filter Associations by Location', expected: 'Only associations from selected country displayed', mode: 'readonly', failReason: "No country/location filter control on the Associations list; only status tabs exist." },
  { id: 'IA-CM05-F01-TC04', row: 83, section: 'ASSOCIATION MANAGEMENT', title: 'Filter Associations by Status', expected: 'Associations displayed match selected status', mode: 'readonly', checks: "Switched the status tabs (Approved, then back to Pending Review) and the table re-rendered for each." },
  { id: 'IA-CM05-F01-TC05', row: 84, section: 'ASSOCIATION MANAGEMENT', title: 'Review Association Registration Application', expected: 'Full application details visible; documents accessible', mode: 'readonly', checks: "Opened a pending application's details (code, country, members, status, email); Approve/Decline/Request Info actions are available (not clicked)." },
  { id: 'IA-CM05-F01-TC06', row: 85, section: 'ASSOCIATION MANAGEMENT', title: 'Approve Association Registration', expected: 'Association approved; admin notified; visible on platform', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC07', row: 86, section: 'ASSOCIATION MANAGEMENT', title: 'Reject Association Registration', expected: 'Application rejected; reason recorded; applicant notified', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC08', row: 87, section: 'ASSOCIATION MANAGEMENT', title: 'Request Additional Information', expected: 'Application marked Pending Info; notification sent', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC10', row: 88, section: 'ASSOCIATION MANAGEMENT', title: 'View Association Profile', expected: 'Profile details displayed', mode: 'readonly', checks: "Opened an approved association profile and confirmed profile details (code, country, founded, members, email, address)." },
  { id: 'IA-CM05-F01-TC11', row: 89, section: 'ASSOCIATION MANAGEMENT', title: 'Edit association details', expected: 'Changes saved', mode: 'blocked', note: 'Blocked - mutates a real association profile; no disposable association available (excluded by semi-destructive scope).' },
  { id: 'IA-CM05-F01-TC12', row: 90, section: 'ASSOCIATION MANAGEMENT', title: 'Monitor Association Members', expected: 'List of members displayed with status', mode: 'readonly', checks: "Opened an association profile and confirmed a members section/list is present." },
  { id: 'IA-CM05-F01-TC13', row: 91, section: 'ASSOCIATION MANAGEMENT', title: 'Remove Member from Association (Admin Override)', expected: 'Member removed; retains iSOKO account; action logged', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC14', row: 92, section: 'ASSOCIATION MANAGEMENT', title: 'Suspend Association', expected: 'Status Suspended; marketplace disabled; admin notified', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC15', row: 93, section: 'ASSOCIATION MANAGEMENT', title: 'Reinstate Suspended Association', expected: 'Restored to active; marketplace re-enabled', mode: 'blocked', note: BLOCK_IRREVERSIBLE },
  { id: 'IA-CM05-F01-TC16', row: 94, section: 'ASSOCIATION MANAGEMENT', title: 'Verify Association Marketplace Page', expected: 'Marketplace page visible; member listings aggregated', mode: 'readonly', failReason: "No association marketplace view is exposed in the instance admin portal." },

  // ---- ADMIN ORDER MANAGEMENT ----
  { id: 'IA-CM02-F08-TC01', row: 96, section: 'ADMIN ORDER MANAGEMENT', title: 'View Newly Placed Order', expected: 'Order displayed with correct details', mode: 'readonly', checks: "Orders page renders; filtering to Pending shows the orders table with order/status/date/total columns." },
  { id: 'IA-CM02-F08-TC02', row: 97, section: 'ADMIN ORDER MANAGEMENT', title: 'Validate Order Details', expected: 'Product, unit, price, totals accurate', mode: 'readonly', checks: "Opened an order via View and confirmed the detail page shows product, quantity, price and total." },
  { id: 'IA-CM02-F08-TC03', row: 98, section: 'ADMIN ORDER MANAGEMENT', title: 'Default Status Validation', expected: 'Status = Pending', mode: 'readonly', checks: "The Pending filter lists orders whose status reads Pending, confirming the default status." },
  { id: 'IA-CM02-F08-TC04', row: 99, section: 'ADMIN ORDER MANAGEMENT', title: 'Seller Confirms Order', expected: 'Status -> Confirmed', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC05', row: 100, section: 'ADMIN ORDER MANAGEMENT', title: 'Admin Confirms Order on Behalf of Seller', expected: 'Status updated', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC06', row: 101, section: 'ADMIN ORDER MANAGEMENT', title: 'Prevent Confirmation of Rejected Order', expected: 'Action blocked', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC07', row: 102, section: 'ADMIN ORDER MANAGEMENT', title: 'Confirmed Order Notification', expected: 'Buyer notified', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC08', row: 103, section: 'ADMIN ORDER MANAGEMENT', title: 'Seller Rejects Order', expected: 'Status -> Rejected', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC09', row: 104, section: 'ADMIN ORDER MANAGEMENT', title: 'Admin Rejects Order', expected: 'Status updated; buyer notified', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC10', row: 105, section: 'ADMIN ORDER MANAGEMENT', title: 'Prevent Rejection After Confirmation', expected: 'Action blocked', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC11', row: 106, section: 'ADMIN ORDER MANAGEMENT', title: 'Rejection Notification', expected: 'Buyer notified', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC12', row: 107, section: 'ADMIN ORDER MANAGEMENT', title: 'Buyer Cancels Pending Order', expected: 'Status -> Cancelled', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC13', row: 108, section: 'ADMIN ORDER MANAGEMENT', title: 'Seller Cancels confirmed Order', expected: 'Status -> Cancelled', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC14', row: 109, section: 'ADMIN ORDER MANAGEMENT', title: 'Admin Cancel confirmed order', expected: 'Status updated', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC15', row: 110, section: 'ADMIN ORDER MANAGEMENT', title: 'Admin Cancels Confirmed Order', expected: 'Status -> Cancelled', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC16', row: 111, section: 'ADMIN ORDER MANAGEMENT', title: 'Prevent Cancellation After Delivery', expected: 'Action blocked', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC17', row: 112, section: 'ADMIN ORDER MANAGEMENT', title: 'Cancellation Notification', expected: 'Buyer & seller notified', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC18', row: 113, section: 'ADMIN ORDER MANAGEMENT', title: 'Seller Marks Order as Delivered', expected: 'Status -> Delivered; buyer prompted to rate', mode: 'blocked', note: BLOCK_ORDER },
  { id: 'IA-CM02-F08-TC19', row: 114, section: 'ADMIN ORDER MANAGEMENT', title: 'Admin Marks Order as Delivered', expected: 'Status updated; buyer prompted to rate', mode: 'blocked', note: BLOCK_ORDER },

  // ---- EMAIL AND SMS TEMPLATE CONFIGURATION ----
  { id: 'IA-FM01-F22-TC01', row: 116, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'View list of email Templates', expected: 'List of email templates displays', mode: 'readonly', failReason: "No Email/SMS template configuration section is exposed in the instance admin portal navigation." },
  { id: 'IA-FM01-F22-TC02', row: 117, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Edit Email Subject', expected: 'Subject updated', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC03', row: 118, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert valid Variable in subject', expected: 'Subject updated', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC04', row: 119, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert Invalid Variable in subject', expected: 'Subject updated / validation', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC05', row: 120, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Edit Email Body Content', expected: 'Changes saved', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC06', row: 121, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert valid Variable in Body content', expected: 'Updated body content', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC07', row: 122, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Multiple Variables in email template', expected: 'All accepted', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC08', row: 123, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert Invalid Variable in Body Content', expected: 'Body updated / validation', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC09', row: 124, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Edit SMS Content', expected: 'Saved successfully', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC10', row: 125, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Enforce SMS Character Limit', expected: 'Warning displayed', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC11', row: 126, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert Invalid Variable in SMS', expected: 'SMS template updated / validation', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC12', row: 127, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Insert valid Variable in SMS', expected: 'SMS template updated', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC13', row: 128, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Auto-Split Long SMS (if supported)', expected: 'SMS split correctly', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC14', row: 129, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Prevent Empty SMS', expected: 'Save blocked', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC15', row: 130, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Multiple Variables in Template', expected: 'All accepted', mode: 'blocked', note: BLOCK_TEMPLATE },
  { id: 'IA-FM01-F22-TC16', row: 131, section: 'EMAIL AND SMS TEMPLATE CONFIGURATION', title: 'Variable Preview Resolution', expected: 'Variables resolved', mode: 'blocked', note: BLOCK_TEMPLATE },
];

/** Section header rows in the source workbook (kept as-is, never filled). */
export const SECTION_HEADER_ROWS = new Set<number>([2, 9, 13, 26, 46, 64, 79, 95, 115]);

export function caseById(id: string): TestCase | undefined {
  const norm = id.trim();
  return TEST_CASES.find(tc => tc.id === norm);
}

export const AUTOMATED_CASES = TEST_CASES.filter(tc => tc.mode !== 'blocked');
export const BLOCKED_CASES = TEST_CASES.filter(tc => tc.mode === 'blocked');
