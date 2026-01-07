import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UploadForm from "@/components/UploadForm";
import * as api from "@/lib/api";
import { JobStatus, JobType } from "@/lib/enums";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof api>("@/lib/api");
  return {
    ...actual,
    postGenerate: vi.fn(() =>
      Promise.resolve({
        type: JobType.GENERATE,
        jobId: "mock123",
        progress: 0,
        status: JobStatus.QUEUED,
      })
    ),
  };
});

describe("UploadForm", () => {
  it("shows error when no file selected", async () => {
    render(<UploadForm onJob={() => {}} />);
    const button = screen.getByRole("button", { name: /generate/i });
    fireEvent.click(button);
    expect(screen.getByText(/please select an image/i)).toBeInTheDocument();
  });

  it("calls postGenerate and onJob when valid input", async () => {
    const mockOnJob = vi.fn();
    render(<UploadForm onJob={mockOnJob} />);

    const fileInput = screen.getByTestId("file-input");
    const promptInput = screen.getByPlaceholderText(/enter prompt/i);
    const button = screen.getByRole("button", { name: /generate/i });

    const file = new File(["dummy"], "test.png", { type: "image/png" });

    // Simulate selecting file and entering prompt
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(promptInput, { target: { value: "make a cat" } });

    // Simulate form submit
    fireEvent.click(button);

    await waitFor(() => expect(api.postGenerate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockOnJob).toHaveBeenCalled());
  });
});
