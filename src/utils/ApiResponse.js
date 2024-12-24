// export class ApiResponse {
//     constructor(status, message, response=null) {
//         this.status = status;
//         this.message = message;
//         this.response = response;
//     }
// }



function ApiResponse(status, message, response) {
    this.status = status;
    this.message = message;
    this.response = response || null; 
  }
  
  module.exports = ApiResponse;
  