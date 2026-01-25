-- Function to update user_name based on full_name
CREATE OR REPLACE FUNCTION update_user_name()
RETURNS TRIGGER AS
$$ BEGIN
	NEW.user_name := LOWER(
	REGEXP_REPLACE(NEW.full_name,
	'\s+', '_', 'g')) || '_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
	RETURN NEW;
END; $$
LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_name
BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION update_user_name();