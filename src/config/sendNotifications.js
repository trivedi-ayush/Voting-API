const AWS = require("aws-sdk");

AWS.config.update({ region: process.env.AWS_REGION });
const sns = new AWS.SNS();

const sendNotifications = async (phoneNumber, name) => {
  //   const notifications = [];

  // SMS notification via SNS
  if (phoneNumber) {
    const smsParams = {
      PhoneNumber: phoneNumber, // E.164 format (+1234567890)
      Message: `Hi ${name}, welcome! Your registration is successful.`,
    };

    try {
      const result = await sns.publish(smsParams).promise();
      return result;
    } catch (error) {
      console.error("Error sending SMS notification:", error);
      throw error; // Rethrow the error for further handling
    }
  }

  // Execute notifications concurrently
  //   return Promise.all(notifications);
};

module.exports = { sendNotifications };
