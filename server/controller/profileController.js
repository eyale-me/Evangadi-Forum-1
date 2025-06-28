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
    WHERE r.user_uuid = ?;
  `;
  const [rows] = await db.execute(query, [userUuid]);
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

  const client = await db.getConnection();

  try {
    await client.beginTransaction();

    // First, verify that the user_uuid from the URL corresponds to the authenticated user
    const [userRows] = await client.query(
      "SELECT user_id FROM registration WHERE user_uuid = ?",
      [user_uuid]
    );

    if (userRows.length === 0) {
      await client.rollback();
      return res.status(404).json({ message: "User profile not found." });
    }

    const targetUserId = userRows[0].user_id;

    // Security check: Ensure the authenticated user is the owner of the profile
    if (targetUserId !== authenticatedUserId) {
      await client.rollback();
      return res
        .status(403)
        .json({ message: "Forbidden: You can only update your own profile." });
    }

    // Update registration table with the authenticated user's ID
    await client.query(
      "UPDATE registration SET user_name = ? WHERE user_id = ?",
      [user_name, authenticatedUserId]
    );

    // Upsert profile table with the authenticated user's ID
    const upsertProfileQuery = `
      INSERT INTO profile (user_id, first_name, last_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        first_name = VALUES(first_name), 
        last_name = VALUES(last_name);
    `;
    await client.query(upsertProfileQuery, [
      authenticatedUserId,
      first_name,
      last_name,
    ]);

    await client.commit();

    // Fetch the newly updated profile to return, using the UUID
    const updatedProfile = await fetchUserProfile(user_uuid);

    res.json({
      message: "Profile updated successfully",
      user: {
        userid: updatedProfile.user_id,
        user_uuid: updatedProfile.user_uuid, // also return uuid
        username: updatedProfile.user_name,
        email: updatedProfile.user_email,
        firstname: updatedProfile.first_name,
        lastname: updatedProfile.last_name, // also return lastname
      },
    });
  } catch (err) {
    await client.rollback();
    handleError(res, "Update failed.", err);
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
    const result = await db.execute(
      "DELETE FROM registration WHERE user_uuid = ?",
      [user_uuid]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found, nothing to delete." });
    }

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    handleError(res, "Deletion failed.", err);
  }
};
