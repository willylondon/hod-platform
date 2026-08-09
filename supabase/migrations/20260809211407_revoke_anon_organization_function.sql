-- The hosted project grants exposed functions directly to API roles. The
-- organization editor is authenticated-only, so remove the unnecessary anon
-- entry point while preserving the Settings flow for signed-in app users.
REVOKE ALL ON FUNCTION set_profile_organization(TEXT, TEXT) FROM anon;
