export interface NexusNode {
  id: string;
  name: string;
  type: "document" | "concept";
  color: string;
  val: number;
  documentId?: string;
}

export interface NexusLink {
  source: string;
  target: string;
}

export interface NexusGraphData {
  nodes: NexusNode[];
  links: NexusLink[];
}
