import { Expose } from "class-transformer";

export class BaseResponse<T> {
    @Expose()
    success: boolean;
  
    @Expose()
    message: string;
  
    @Expose()
    data?: T;
  
    constructor(success: boolean, message: string, data?: T) {
      this.success = success;
      this.message = message;
      this.data = data;
    }
  }
