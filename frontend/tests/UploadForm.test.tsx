import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UploadForm from "@/components/UploadForm";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof api>("@/lib/api");
  return {
    ...actual,
    postTrain: vi.fn(() => Promise.resolve({ trainJobId: "mock123" })),
  };
});

describe("UploadForm", () => {
  it("shows error when no file selected", async () => {
    render(<UploadForm onJob={() => {}} />);
    const button = screen.getByRole("button", { name: /train/i });
    fireEvent.click(button);
    expect(screen.getByText(/please select an image/i)).toBeInTheDocument();
  });

  it("calls postTrain and onJob when valid input", async () => {
    const mockOnJob = vi.fn();
    render(<UploadForm onJob={mockOnJob} />);

    const fileInput = screen.getByTestId("file-input");
    const promptInput = screen.getByPlaceholderText(/enter prompt/i);
    const button = screen.getByRole("button", { name: /train/i });

    const file = new File(["dummy"], "test.png", { type: "image/png" });

    // Simulate selecting file and entering prompt
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(promptInput, { target: { value: "make a cat" } });

    // Simulate form submit
    fireEvent.click(button);

    await waitFor(() => expect(api.postTrain).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockOnJob).toHaveBeenCalled());
  });
});
