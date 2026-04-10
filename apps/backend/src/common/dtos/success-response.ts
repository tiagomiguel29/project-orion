import { Expose } from "class-transformer";

export class SuccessResponse<T> {
    @Expose()
    success = true;
  
    @Expose()
    data: T;
  
    @Expose()
    meta?: Record<string, any>;
  
    constructor(data: T, meta?: Record<string, any>) {
      this.data = data;
      this.meta = meta;
    }
  }
  