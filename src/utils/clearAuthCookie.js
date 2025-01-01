const clearAuthCookie = (res) => {
  res.cookie("authToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
  });
};

module.exports = clearAuthCookie;
