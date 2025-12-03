import { describe, it, expect } from "vitest";
import { Planner } from "../src/core/planner.js";

const getGraph = (planner, request) => {
  const jobId = "job-test";
  const json = planner.getJobGraph({ workflowId: jobId, request });
  return JSON.parse(json);
};

describe("Planner pipeline graph", () => {
  it("builds default train-and-generate SVD+Wav2Lip graph", () => {
    const planner = new Planner();
    const graph = getGraph(planner, {
      mode: "train_and_generate",
      variant: "svd_wav2lip",
      prompt: "hello",
    });

    expect(graph.nodes.map((n) => n.id)).toEqual([
      "script",
      "train_lora",
      "train_voice",
      "render_video",
    ]);

    const renderNode = graph.nodes.find((n) => n.id === "render_video");
    expect(renderNode?.params?.preset).toBe("svd_wav2lip");
    expect(graph.context?.pipeline?.mode).toBe("train_and_generate");
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "script", to: "train_lora" }),
        expect.objectContaining({ from: "train_lora", to: "render_video" }),
        expect.objectContaining({ from: "script", to: "train_voice" }),
        expect.objectContaining({ from: "train_voice", to: "render_video" }),
      ])
    );
  });

  it("builds generate-only SadTalker graph with metadata", () => {
    const planner = new Planner();
    const req = {
      mode: "generate_from_profile",
      variant: "sadtalker",
      prompt: "talking head",
      profileId: "profile-1",
      options: { durationSeconds: 30, resolution: "576p" },
    };
    const graph = getGraph(planner, req);

    expect(graph.nodes.map((n) => n.id)).toEqual(["script", "render_video"]);
    const renderNode = graph.nodes.find((n) => n.id === "render_video");
    expect(renderNode?.params?.preset).toBe("sadtalker");
    expect(renderNode?.params?.options).toEqual({
      durationSeconds: 30,
      resolution: "576p",
    });
    expect(graph.context?.pipeline).toMatchObject({
      mode: "generate_from_profile",
      variant: "sadtalker",
      profileId: "profile-1",
    });
  });
});
