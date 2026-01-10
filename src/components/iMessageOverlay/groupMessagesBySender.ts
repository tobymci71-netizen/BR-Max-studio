import { Message } from "@/types/constants";

export const groupMessagesBySender = (messages: Message[]) => {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  let currentSender: string | null = null;

  messages.forEach((msg) => {
    if (msg.sender === currentSender) {
      currentGroup.push(msg);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [msg];
      currentSender = msg.sender;
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};
