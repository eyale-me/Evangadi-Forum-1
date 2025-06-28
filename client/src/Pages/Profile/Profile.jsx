import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaUserCircle, FaEdit } from "react-icons/fa";
import { ClipLoader } from "react-spinners";

import api from "../../Utility/axios";
import { UserContext } from "../../Components/Context/UserContext";
import Layout from "../../Components/Layout/Layout";
import styles from "./profile.module.css";

const ProfilePage = () => {
  const { userData, setUserData } = useContext(UserContext);
  const { user_uuid } = useParams();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
  });
  const [initialForm, setInitialForm] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    if (!user_uuid) {
      navigate("/404");
      return;
    }

    setIsLoading(true);
    api
      .get(`/profile/${user_uuid}`)
      .then((res) => {
        const fetchedData = {
          firstname: res.data.first_name || "",
          lastname: res.data.last_name || "",
          username: res.data.user_name || "",
          email: res.data.user_email || "",
          user_uuid: res.data.user_uuid,
        };
        setProfileData(fetchedData);
        setForm(fetchedData);
        setInitialForm(fetchedData);
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
        toast.error("Failed to fetch profile data.");
        if (err.response?.status === 404) {
          navigate("/404");
        }
      })
      .finally(() => setIsLoading(false));
  }, [user_uuid, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await api.put(`/profile/${user_uuid}`, {
        first_name: form.firstname,
        last_name: form.lastname,
        user_name: form.username,
      });
      const updatedUserData = {
        ...userData,
        firstname: form.firstname,
        lastname: form.lastname,
        username: form.username,
        email: form.email,
      };
      setUserData(updatedUserData);
      setProfileData((prev) => ({
        ...prev,
        firstname: form.firstname,
        lastname: form.lastname,
        username: form.username,
      }));
      setInitialForm(form);
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      toast.error("Error updating profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmInput !== "DELETE") {
      toast.warn('Please type "DELETE" to confirm.');
      return;
    }
    setIsLoading(true);
    try {
      await api.delete(`/profile/${user_uuid}`);
      toast.success("Account deleted successfully. We're sad to see you go!");
      setUserData(null);
      navigate("/landing");
    } catch (err) {
      toast.error("Error deleting account. Please try again.");
      setIsLoading(false);
    }
    // No finally block for loading, as we navigate away on success.
  };

  const handleCancelEdit = () => {
    setForm(initialForm); // Revert to last saved state
    setIsEditing(false);
  };

  if (isLoading && !showDeleteConfirm) {
    return (
      <Layout>
        {" "}
        {/* Wrap loader in Layout */}
        <div className={styles.loaderContainer}>
          <ClipLoader color="var(--primary)" size={80} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {" "}
      {/* Wrap main content in Layout */}
      <div className={styles.profileContainer}>
        <div className={styles.profileCard}>
          {isEditing ? (
            // --- Edit View ---
            <form onSubmit={handleUpdate} className={styles.editForm}>
              <h2>Edit Profile</h2>
              <div className={styles.inputGroup}>
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="firstname">First Name</label>
                <input
                  id="firstname"
                  name="firstname"
                  value={form.firstname}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="lastname">Last Name</label>
                <input
                  id="lastname"
                  name="lastname"
                  value={form.lastname}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ClipLoader size={20} color="#fff" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            // --- Display View ---
            <div className={styles.displayView}>
              <FaUserCircle
                className={styles.userIcon}
                style={{ color: "#1e3a5f" }}
              />
              <h2 className={styles.userName}>{profileData.username}</h2>
              <p
                className={styles.fullName}
              >{`${profileData.firstname} ${profileData.lastname}`}</p>
              <p className={styles.email}>{profileData.email}</p>
              {userData?.user_uuid === user_uuid && (
                <div className={styles.profileActions}>
                  <button
                    className={styles.editButton}
                    onClick={() => setIsEditing(true)}
                  >
                    <FaEdit /> Edit Profile
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Delete Confirmation Modal --- */}
        {showDeleteConfirm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3>Confirm Account Deletion</h3>
              <p>
                This action is irreversible. To confirm, please type{" "}
                <strong>DELETE</strong> in the box below.
              </p>
              <input
                type="text"
                className={styles.confirmInput}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder='Type "DELETE" here'
              />
              <div className={styles.modalActions}>
                <button
                  className={styles.confirmDeleteButton}
                  onClick={handleDelete}
                  disabled={deleteConfirmInput !== "DELETE" || isLoading}
                >
                  {isLoading ? (
                    <ClipLoader size={20} color="#fff" />
                  ) : (
                    "Delete My Account"
                  )}
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProfilePage;
