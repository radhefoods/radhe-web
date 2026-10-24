import { describe, expect, it } from "vitest";
import { markdownToText } from "./markdown";

describe("markdownToText", () => {
  it("keeps the words and drops the marks", () => {
    expect(
      markdownToText(
        "# Dal\n\nWash the **lentils** until the water runs _clear_.\n\n- 200 g toor dal\n- 1 tsp `turmeric`\n\n> Serve with rice.",
      ),
    ).toBe(
      "Dal Wash the lentils until the water runs clear. 200 g toor dal 1 tsp turmeric Serve with rice.",
    );
  });

  it("keeps the text of a link and the description of a picture", () => {
    expect(
      markdownToText(
        "Use the [right of withdrawal](/legal/withdrawal). ![A bowl](https://cdn.example/a.webp)",
      ),
    ).toBe("Use the right of withdrawal. A bowl");
  });

  it("keeps the cells of a table and drops its rule", () => {
    expect(
      markdownToText("| Region | Time |\n| --- | --- |\n| Germany | 2 days |"),
    ).toBe("Region Time Germany 2 days");
  });

  it("leaves plain text as it is", () => {
    expect(markdownToText("Not yet.")).toBe("Not yet.");
  });
});
