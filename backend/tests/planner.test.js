import { describe, it, expect } from "vitest";
import { Planner } from "../src/core/planner.js";

const getGraph = (planner, input) => {
  const jobId = "job-test";
  const json = planner.getJobGraph({ workflowId: jobId, input });
  return JSON.parse(json);
};

describe("Planner pipeline graph", () => {
  it("builds default train-and-generate SVD+Wav2Lip graph", () => {
    const planner = new Planner();
    const graph = getGraph(planner, {
      mode: "fixed_graph",
      variant: "svd_wav2lip",
      params: {
        script: {
          prompt: "hello",
        },
      },
    });

    expect(graph.nodes.map((n) => n.id)).toEqual([
      "script",
      "train_voice",
      "train_lora",
      "generate_video",
      "postprocess_video",
    ]);

    const postProcNode = graph.nodes.find((n) => n.id === "postprocess_video");
    expect(postProcNode?.params?.preset).toBe("svd_wav2lip");
    expect(graph.context?.pipeline?.mode).toBe("fixed_graph");
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "script", to: "train_lora" }),
        expect.objectContaining({ from: "train_lora", to: "generate_video" }),
        expect.objectContaining({ from: "script", to: "train_voice" }),
        expect.objectContaining({ from: "train_voice", to: "generate_video" }),
        expect.objectContaining({
          from: "generate_video",
          to: "postprocess_video",
        }),
      ])
    );
  });

  it("builds generate-only SadTalker graph with metadata", () => {
    const planner = new Planner();
    const req = {
      mode: "fixed_graph",
      variant: "sadtalker",
      params: {
        script: { prompt: "talking head" },
        postprocess_video: { durationSeconds: 30, resolution: "576p" },
      },
    };
    const graph = getGraph(planner, req);

    expect(graph.nodes.map((n) => n.id)).toEqual([
      "script",
      "train_voice",
      "generate_video",
      "postprocess_video",
    ]);
    const postProcNode = graph.nodes.find((n) => n.id === "postprocess_video");
    expect(postProcNode?.params?.preset).toBe("sadtalker");
    expect(postProcNode?.params?.durationSeconds).toEqual(30);
    expect(postProcNode?.params?.resolution).toBe("576p");
    expect(graph.context?.pipeline).toMatchObject({
      mode: "fixed_graph",
      variant: "sadtalker",
    });
  });
});
