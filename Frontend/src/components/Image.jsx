import React from "react";

const buildDefaultAvatar = (altText) => {
  const name = (altText || "U").trim();
  const initials = name
    .split(/\s+/)
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = "%23c7d2fe"; // #c7d2fe
  const fg = "%230b3d91"; // #0b3d91
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='72' fill='${fg}' font-family='Arial,Helvetica,sans-serif'>${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const safeJoinBackend = (srcPath) => {
  const base = import.meta.env.VITE_BACKEND_URL || "";
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = String(srcPath).replace(/^\/+/, "").replace(/\\/g, "/");
  return `${cleanBase}/${cleanPath}`;
};

const ProfileImage = ({ src, alt, className, ...props }) => {
  const [imgSrc, setImgSrc] = React.useState(() => {
    if (!src) return buildDefaultAvatar(alt);
    if (typeof src === "string") {
      if (src.startsWith("http") || src.startsWith("data:")) return src;
      return safeJoinBackend(src);
    }
    return buildDefaultAvatar(alt);
  });

  const handleError = () => {
    setImgSrc(buildDefaultAvatar(alt));
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  );
};

export default ProfileImage;
