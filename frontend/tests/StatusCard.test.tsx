import { render, screen } from "@testing-library/react";
import StatusCard from "@/components/StatusCard";
import type { Job } from "@/lib/api";
import { JobStatus, JobType } from "@/lib/enums";

const jobBase: Job = {
  jobId: "abc12345",
  type: JobType.GENERATE,
  status: JobStatus.RUNNING,
  createdAt: Date.now(),
  progress: 0.3,
};

describe("StatusCard", () => {
  it("shows job id and status pill", () => {
    render(<StatusCard job={jobBase} />);
    expect(screen.getByText(/#abc12345/i)).toBeInTheDocument();
    expect(screen.getByText(JobStatus.RUNNING)).toBeInTheDocument();
  });

  it("renders prompt if provided", () => {
    render(<StatusCard job={{ ...jobBase, prompt: "hello world" }} />);
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });

  it("shows progress percentage", () => {
    render(<StatusCard job={jobBase} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders result link only when done", () => {
    render(
      <StatusCard
        job={{
          ...jobBase,
          status: JobStatus.COMPLETED,
          resultUrl: "https://example.com",
        }}
      />
    );
    expect(screen.getByText("View result")).toHaveAttribute(
      "href",
      "https://example.com"
    );
  });
});
