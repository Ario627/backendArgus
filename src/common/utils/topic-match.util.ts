export const topicMatchesFilter = (filter: string, topic: string): boolean => {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  for (let index = 0; index < filterParts.length; index += 1) {
    const part = filterParts[index];
    if (part === '#') return index === filterParts.length - 1;
    if (index >= topicParts.length) return false;
    if (part !== '+' && part !== topicParts[index]) return false;
  }
  return filterParts.length === topicParts.length;
};