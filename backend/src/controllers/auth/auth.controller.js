import { authService } from "../../services/auth/auth.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";

class AuthController {
    register = autoCatchFn(async (request, response) => {
        const result = await authService.register(request.body, request);
        return response.status(201).render("register", {
            success: true,
            ...result,
        });
    });

    login = autoCatchFn(async (request, response) => {
        const result = await authService.login(request.body, request);
        return response.status(200).render("login", {
            success: true,
            ...result,
        });
    });

    loginWithGoogle = autoCatchFn(async (request, response) => {
        const result = await authService.loginWithGoogle(request.body, request);
        return response.status(200).render("loginWithGoogle", {
            success: true,
            ...result,
        });
    });

    refreshToken = autoCatchFn(async (request, response) => {
        const result = await authService.refreshToken(request.body, request);
        return response.status(200).render("refreshToken", {
            success: true,
            ...result,
        });
    });

    logout = autoCatchFn(async (request, response) => {
        const result = await authService.logout(request.body);
        return response.status(200).render("logout", {
            success: true,
            ...result,
        });
    });

    me = autoCatchFn(async (request, response) => {
        const result = await authService.me(request.user._id);
        return response.status(200).render("me", {
            success: true,
            ...result,
        });
    });
}

const authController = new AuthController();

export { authController };
export default authController;