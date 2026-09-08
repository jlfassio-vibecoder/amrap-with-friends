import {
  AMQAP_FLOW_CATEGORIES,
  type AmqapFlow,
  type AmqapFlowCategory,
  type AmqapFlowId,
  type AmqapTimeDomain,
} from '@/data/amqapFlows';

export interface AmqapFlowFilter {
  durationMinutes: AmqapTimeDomain;
  flowId: AmqapFlowId;
}

export function filterAmqapFlows(flows: AmqapFlow[], filter: AmqapFlowFilter): AmqapFlow[] {
  return flows.filter(
    (flow) => flow.durationMinutes === filter.durationMinutes && flow.flowId === filter.flowId
  );
}

export function amqapCategoryById(flowId: AmqapFlowId): AmqapFlowCategory | undefined {
  return AMQAP_FLOW_CATEGORIES.find((category) => category.id === flowId);
}
