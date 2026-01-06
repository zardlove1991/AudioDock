import type { Device, ISuccessResponse, User } from "./models";
import request from "./request";

export const login = async (user: Partial<User> & { deviceName?: string }) => {
  const { deviceName = "Unknown Device", ...userData } = user;
  return request.post<any, ISuccessResponse<User & { token: string, device: Device }>>(
    "/auth/login",
    { ...userData, deviceName }
  );
};

export const register = (user: Partial<User> & { deviceName?: string }) => {
  const { deviceName = "Unknown Device", ...userData } = user;
  return request.post<any, ISuccessResponse<User & { token: string, device: Device }>>(
    "/auth/register",
    { ...userData, deviceName }
  );
};

export const check = () => {
  return request.get<any, ISuccessResponse<boolean>>("/auth/check");
};

