export interface RabbitQueueBackingQueueStatus {
  mode: string;
  q1: number;
  q2: number;
  delta: any[];
  q3: number;
  q4: number;
  len: number;
  target_ram_count: string;
  next_seq_id: number;
  avg_ingress_rate: number;
  avg_egress_rate: number;
  avg_ack_ingress_rate: number;
  avg_ack_egress_rate: number;
}

export interface RabbitQueueMessageStats {
  publish?: number;
  publish_details?: { rate: number };
  deliver_get?: number;
  deliver_get_details?: { rate: number };
  ack?: number;
  ack_details?: { rate: number };
}

export interface RabbitQueueInfo {
  name: string;
  vhost: string;
  durable: boolean;
  auto_delete: boolean;
  exclusive: boolean;
  arguments: Record<string, any>;
  status: string;
  consumers: number;
  messages: number; // total messages
  messages_ready: number; // ready messages
  messages_unacknowledged: number; // unacked messages
  message_stats?: RabbitQueueMessageStats;
}
