import { render, screen } from "@testing-library/react";
import ProgressBar from "@/components/ProgressBar";

describe("ProgressBar", () => {
  it("renders with correct width for given value", () => {
    render(<ProgressBar value={0.5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveStyle({ width: "50%" });
  });

  it("clamps value outside 0–1 range", () => {
    render(<ProgressBar value={1.5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });
});
