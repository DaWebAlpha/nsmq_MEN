import { config } from "@backend/src/config/config.js";


const {
        port,
        mongo_uri,
        node_env,
        log_level,
        redis_uri,
        max_failed_attempts,
        lock_duration,
        jwt_access_secret,
        google_client_id,
        google_client_secret,
        google_callback_url,
        cloudinary_cloud_name,
        cloudinary_api_key,
        cloudinary_api_secret,
        mail_host,
        mail_port, 
        mail_secure,
        mail_user,
        mail_pass,
        mail_from, 
} = config;

describe("Configuration settings", () => {

    it("should have a valid port number", () => {
        expect(typeof port).toBe("number");
        expect(port).toBeGreaterThan(0);
        expect(port).toBe(3200);
    })

    it("should have a valid mongo_uri", () => {
        expect(typeof mongo_uri).toBe("string");
        expect(mongo_uri).toBeDefined();
        expect(mongo_uri).toMatch(/mongodb/);
        expect(mongo_uri.length).toBeGreaterThan(0);
    })

    it("should have a valid node_env", () => {
        expect(typeof node_env).toBe("string");
        expect(node_env).toBeDefined();
        expect(node_env).toBe('test');
        expect(node_env.length).toBeGreaterThan(0);
    })

    it("should have a valid log_level", () => {
        expect(typeof log_level).toBe("string");
        expect(log_level).toBeDefined();
        expect(log_level).not.toBe("null");
    })

    it("should have a valid redis_uri", () => {
        expect(typeof redis_uri).toBe("string");
        expect(redis_uri).toBeDefined();
        expect(redis_uri).toMatch(/redis/);
    })

    it("should have a valid max_failed_attempts", () => {
        expect(typeof max_failed_attempts).toBe("number");
        expect(max_failed_attempts).toBeGreaterThan(0);
        expect(max_failed_attempts).toEqual(5);
    })

    it("should have a valid lock_duration", ()=> {
        expect(typeof lock_duration).toBe("number");
        expect(lock_duration).toBeGreaterThan(0);
        expect(lock_duration).toEqual(15 * 60 * 1000);
    })

    it("should be a valid jwt_access_secret", () => {
        expect(typeof jwt_access_secret).toBe("string");
        expect(jwt_access_secret.length).toBeGreaterThan(60);
        expect(jwt_access_secret).toBeDefined();
    })

    it("should have a valid google_client_id", () => {
        expect(typeof google_client_id).toBe("string");
        expect(google_client_id.length).toBeGreaterThan(0);
        expect(google_client_id).toBeDefined();
    })

    it("should have a valid google_client_secret", () => {
        expect(typeof google_client_secret).toBe("string");
        expect(google_client_secret.length).toBeGreaterThan(0);
        expect(google_client_secret).toBeDefined();

    })

    it("should have a valid google_callback_url", () => {
        expect(typeof google_callback_url).toBe("string");
        expect(google_callback_url.length).toBeGreaterThan(0);
        expect(google_callback_url,).toBeDefined();
    })

    it("should have a valid cloudinary_cloud_name", () => {
        expect(typeof cloudinary_cloud_name).toBe("string");
        expect(cloudinary_cloud_name.length).toBeGreaterThan(0);
        expect(cloudinary_cloud_name).toBeDefined();
    })

    it("should have a valid cloudinary_api_key", () => {
        expect(typeof cloudinary_api_key).toBe("string");
        expect(cloudinary_api_key.length).toBeGreaterThan(0);
        expect(cloudinary_api_key).toBeDefined();
    })
    
    it("should have a valid cloudinary_api_secret", () => {
        expect(typeof cloudinary_api_secret).toBe("string");
        expect(cloudinary_api_secret.length).toBeGreaterThan(0);
        expect(cloudinary_api_secret).toBeDefined();
    })

    it("should have a valid mail_host", () => {
        expect(typeof mail_host).toBe("string");
        expect(mail_host.length).toBeGreaterThan(0);
        expect(mail_host).toMatch(/gmail/);
        expect(mail_host).toBeDefined();
    })
    

    it("should have a valid mail_port", ()=> {
        expect(typeof mail_port).toBe("number");
        expect(mail_port).toBe(587);
        expect(mail_port).toBeGreaterThan(0);
        expect(mail_port).toBeDefined();
    })

    it("should be a valid mail_secure", () => {
        expect(typeof mail_secure).toBe('string');
        expect(mail_secure).toBe("false");
        expect(mail_secure).toBeDefined();
        expect(mail_secure).not.toBeNull();
    })

    it("should be a valid mail_user", () => {
        expect(typeof mail_user).toBe("string");
        expect(mail_user).toMatch(/com/);
        expect(mail_user).toBeDefined();
        expect(mail_user).not.toBeNull();
    })

    it("should be a valid mail_pass", () => {
        expect(typeof mail_pass).toBe("string");
        expect(mail_pass.length).toEqual(16);
        expect(mail_pass).toBeDefined();

    })

    it("should be a valid mail_pass", () => {
        expect(typeof mail_from).toBe("string");
        expect(mail_pass.length).toBeGreaterThan(0);
        expect(mail_pass).toBeDefined();
    })
})
