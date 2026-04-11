import { normalizeValue } from "@backend/src/utils/string.utils.js";

describe("Testing for normalize string", () => {
    it("should return the original value if it is not a string", () => {
        expect(normalizeValue(1233)).toBe(1233);
        expect(normalizeValue(true)).toBe(true);
        expect(normalizeValue(null)).toBe(null);
        expect(normalizeValue(undefined)).toBe(undefined);
    });

    it("should trim, lowercase, and collapse multiple spaces", () => {
        // Checks basic trimming and casing
        expect(normalizeValue("  MICHAEL   DOPER")).toBe("michael doper");
        
        // Checks internal multiple spaces and different casing
        expect(normalizeValue(" MiChael  Doper   ")).toBe("michael doper");
    });

    it("should handle newlines and tabs by collapsing them into a single space", () => {
        // Verifies the /\s+/g regex handles more than just standard spaces
        expect(normalizeValue("Michael\nDoper")).toBe("michael doper");
        expect(normalizeValue("Michael\t\tDoper")).toBe("michael doper");
    });
});
