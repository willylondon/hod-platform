-- Allow authenticated users to manage the lifecycle of only their own AI drafts.
DROP POLICY IF EXISTS "Users can update own ai drafts" ON ai_drafts;
DROP POLICY IF EXISTS "Users can delete own ai drafts" ON ai_drafts;

CREATE POLICY "Users can update own ai drafts"
ON ai_drafts FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own ai drafts"
ON ai_drafts FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));
