import { describe, expect, it } from "vitest";
import { categoryFromFoodDescriptiveNote, classifyPlaceByRules } from "../categoryRules";
import { measureRuleCoverage } from "../autoTagMeasurement";
import { Place } from "../../types";

describe("categoryRules", () => {
  it("classifies Malaysian full-meal vocabulary as Food", () => {
    const examples = [
      "Restoran Hua Mui",
      "Kedai Makan Rahmat",
      "Warung Nasi Lemak",
      "Mamak Roti Canai",
      "Old School Eatery",
      "Hong Kong Cuisine",
      "Claypot Chicken Rice",
      "Japanese Dining",
      "Bak Kut Teh Klang",
      "Char Kway Teow Penang",
      "Yong Tau Foo Ampang",
      "Steamboat Restaurant",
      "Dim Sum 茶餐室",
      "Izakaya Dinner House",
    ];

    for (const displayName of examples) {
      expect(classifyPlaceByRules({ displayName }).category, displayName).toBe("Food");
    }
  });

  it("keeps dessert and non-alcoholic drink vocabulary in Snack when no meal token is present", () => {
    const examples = [
      "The Bakery",
      "Teh Tarik Corner",
      "Bubble Tea Lab",
      "Ice Cream Project",
      "蛋糕甜品",
      "பேக்கரி",
    ];

    for (const displayName of examples) {
      expect(classifyPlaceByRules({ displayName }).category, displayName).toBe("Snack");
    }
  });

  it("prioritizes alcohol venue tokens as Drink", () => {
    expect(classifyPlaceByRules({ displayName: "Hidden Cocktail Bar and Kitchen" })).toMatchObject({
      category: "Food",
      confidence: "high",
      ruleId: "food.meal",
      resolution: "Food wins because full-meal tokens override alcohol/nightlife tokens.",
    });

    expect(classifyPlaceByRules({ displayName: "Hidden Cocktail Bar" })).toMatchObject({
      category: "Drink",
      confidence: "high",
      ruleId: "drink.alcohol",
    });
  });

  it("guards non-alcohol bar phrases away from Drink", () => {
    expect(classifyPlaceByRules({ displayName: "Fresh Juice Bar" })).toMatchObject({
      category: "Snack",
      ruleId: "snack.sweets.bakery",
    });
    expect(classifyPlaceByRules({ displayName: "Sushi Bar" })).toMatchObject({
      category: "Food",
      ruleId: "food.meal",
    });
  });

  it("treats cafe alone as medium-confidence Snack", () => {
    expect(classifyPlaceByRules({ displayName: "DUDU DUCK CAFE" })).toMatchObject({
      category: "Snack",
      confidence: "medium",
      ruleId: "snack.sweets.bakery",
    });
  });

  it("uses categorical notes as high-trust input while status notes abstain", () => {
    expect(classifyPlaceByRules({
      displayName: "Bangsar Village",
      userNote: "Visited\nShopping mall",
    })).toMatchObject({
      category: "Shop",
      ruleId: "shop.retail.note",
      matchedOn: "note",
    });

    expect(classifyPlaceByRules({
      displayName: "Unknown Place",
      userNote: "Visited",
    })).toMatchObject({
      category: "Unsorted",
      matchedOn: "none",
    });

    expect(classifyPlaceByRules({
      displayName: "Hidden Cocktail Bar",
      userNote: "Dim sum",
    })).toMatchObject({
      category: "Food",
      ruleId: "food.meal.note",
      matchedOn: "note",
    });
  });

  it("uses address-only matches at medium confidence and leaves weak names Unsorted", () => {
    expect(classifyPlaceByRules({
      displayName: "Somewhere",
      address: "Level 2, Heritage Mall",
    })).toMatchObject({
      category: "Shop",
      confidence: "medium",
    });

    expect(classifyPlaceByRules({ displayName: "Somewhere" })).toMatchObject({
      category: "Unsorted",
      confidence: "low",
    });
  });

  it("extracts only food-descriptive user notes as validation labels", () => {
    expect(categoryFromFoodDescriptiveNote("Dim sum")).toBe("Food");
    expect(categoryFromFoodDescriptiveNote("Butter")).toBe("Snack");
    expect(categoryFromFoodDescriptiveNote("Visited")).toBeNull();
  });

  it("measures coverage and note-set accuracy", () => {
    const places: Place[] = [
      {
        place_name: "Dim Sum House",
        primary_category: "Unsorted",
        detailed_category: "Unknown",
        star_rating: 0,
        review_count: 0,
        user_notes: "Dim sum",
        feature_id: "1:1",
        is_override: false,
      },
      {
        place_name: "Plain Name",
        primary_category: "Unsorted",
        detailed_category: "Unknown",
        star_rating: 0,
        review_count: 0,
        user_notes: "Visited",
        feature_id: "1:2",
        is_override: false,
      },
    ];

    const measured = measureRuleCoverage(places);
    expect(measured).toMatchObject({
      total: 2,
      taggedCount: 1,
      unsortedCount: 1,
      taggedPercent: 50,
      unsortedPercent: 50,
      unsortedNames: ["Plain Name"],
    });
    expect(measured.noteValidation).toMatchObject({
      labelledCount: 1,
      excludedCount: 1,
      correctCount: 1,
      accuracy: 1,
    });
  });
});
