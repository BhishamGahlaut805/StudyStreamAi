import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/authContext";
import toast from "react-hot-toast";

const GoogleLoginButton = ({ onSuccessCredential }) => {
  const { googleLogin } = useAuth();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (onSuccessCredential) {
        await onSuccessCredential(credentialResponse.credential);
        return;
      }

      await googleLogin({
        tokenId: credentialResponse.credential,
        role: "student", // Default role for Google login
      });
    } catch (error) {
      toast.error("Google login failed");
    }
  };

  const handleGoogleError = () => {
    toast.error("Google login failed. Please try again.");
  };

  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        theme="filled_blue"
        shape="rectangular"
        size="large"
        text="continue_with"
        width="100%"
      />
    </div>
  );
};

export default GoogleLoginButton;
