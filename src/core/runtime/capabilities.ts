export interface SpatialCapability {
  name: string;
  title: string;
  available: boolean;
  description?: string;
}

export class SpatialCapabilityRegistry {
  private readonly capabilities: Map<string, SpatialCapability>;

  constructor(capabilities: SpatialCapability[]) {
    this.capabilities = new Map(capabilities.map((capability) => [capability.name, capability]));
  }

  catalog(): SpatialCapability[] {
    return Array.from(this.capabilities.values()).filter((capability) => capability.available);
  }

  has(name: string): boolean {
    return this.capabilities.get(name)?.available === true;
  }
}
