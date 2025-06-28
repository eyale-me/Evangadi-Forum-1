const db = require("../db/db.Config");

// --- Helper Functions ---

/**
 * Centralized error handler to keep code DRY.
 * @param {object} res - The Express response object.
 * @param {string} message - A user-friendly message for the error.
 * @param {Error} error - The caught error object.
 */
const handleError = (res, message = "An unexpected error occurred.", error) => {
  console.error(message, error);
  res
    .status(500)
    .json({ message, error: error ? error.message : "Unknown error" });
};

/**
 * Fetches a user's combined profile and registration data in a single query.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<object|null>} The user's profile data or null if not found.
 */
const fetchUserProfile = async (userUuid) => {
  const query = `
    SELECT 
      r.user_id, 
      r.user_uuid,
      r.user_name, 
      r.user_email, 
      COALESCE(p.first_name, '') as first_name, 
      COALESCE(p.last_name, '') as last_name
    FROM registration r
    LEFT JOIN profile p ON r.user_id = p.user_id
    WHERE r.user_uuid = $1;
  `;
  const { rows } = await db.query(query, [userUuid]);
  return rows[0];
};

// --- Route Handlers ---

/**
 * GET profile by user_id.
 */
exports.getProfile = async (req, res) => {
  try {
    const profile = await fetchUserProfile(req.params.user_uuid);

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(profile);
  } catch (err) {
    handleError(res, "Server error while fetching profile.", err);
  }
};

/**
 * UPDATE a user's profile and registration info.
 */
exports.updateProfile = async (req, res) => {
  const { user_uuid } = req.params; // Use user_uuid from URL
  const authenticatedUserId = req.user.userid; // Use authenticated user's ID from token

  const { first_name, last_name, user_name } = req.body;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // First, verify that the user_uuid from the URL corresponds to the authenticated user
    const { rows: userRows } = await client.query(
      "SELECT user_id FROM registration WHERE user_uuid = $1",
      [user_uuid]
    );

    if (userRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].user_id;

    // Security check: Ensure the authenticated user is the owner of the profile
    if (userId !== authenticatedUserId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (user_name) {
      await client.query(
        "UPDATE registration SET user_name = $1 WHERE user_id = $2",
        [user_name, userId]
      );
    }
    await client.query(
      "UPDATE profile SET first_name = $1, last_name = $2 WHERE user_id = $3",
      [first_name, last_name, userId]
    );

    await client.query("COMMIT");
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    handleError(res, "Server error while updating profile.", err);
  } finally {
    client.release();
  }
};

/**
 * DELETE a user's account.
 */
exports.deleteProfile = async (req, res) => {
  try {
    const { user_uuid } = req.params;
    const { rows: userRows } = await db.query(
      "SELECT user_id FROM registration WHERE user_uuid = $1",
      [user_uuid]
    );

    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found, nothing to delete." });
    }

    const user_id = userRows[0].user_id;
    const result = await db.query(
      "DELETE FROM registration WHERE user_id = $1",
      [user_id]
    );

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    handleError(res, "Deletion failed.", err);
  }
};
