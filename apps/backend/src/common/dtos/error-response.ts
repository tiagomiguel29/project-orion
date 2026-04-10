import { Expose } from "class-transformer";

export class ErrorResponse {
    @Expose()
    success = false;
  
    @Expose()
    error: {
      code: string;
      message: string;
    };
  
    constructor(code: string, message: string) {
      this.error = { code, message };
    }
  }
  