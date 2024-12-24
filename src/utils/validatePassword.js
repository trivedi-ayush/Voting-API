const password = "Example@123";
const regex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validatePassword = (password) => {
  if (regex.test(password)) {
    return true;
  } else {
    return false;
  }
};
