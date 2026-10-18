-- College ranks: one president per college, and ranks end when someone leaves the college
-- or loses verification. Applied by server/db.js after the columns exist. Idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_one_president ON profiles(college_id) WHERE college_role = 'president';

CREATE TRIGGER IF NOT EXISTS reset_college_role_on_move
AFTER UPDATE OF college_id, is_verified ON profiles
WHEN NEW.college_role <> 'member'
 AND NEW.college_role = OLD.college_role
 AND (NEW.college_id IS NOT OLD.college_id OR NEW.is_verified = 0)
BEGIN
  UPDATE profiles SET college_role = 'member', committee_name = NULL WHERE id = NEW.id;
END;
