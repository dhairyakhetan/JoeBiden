interface Category {
  value: string
  label: string
  emoji: string
}

const CATEGORIES: Category[] = [
  { value: '', label: 'All', emoji: '📋' },
  { value: 'events', label: 'Events', emoji: '🎪' },
  { value: 'welfare', label: 'Welfare', emoji: '💚' },
  { value: 'content', label: 'Content', emoji: '📝' },
  { value: 'operations', label: 'Operations', emoji: '⚙️' },
  { value: 'labs', label: 'Labs', emoji: '🔬' },
]

// Categories without "All" option for post creation
export const categories = CATEGORIES.filter(c => c.value !== '')

export const getCategoryInfo = (value: string): Category => {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0]
}
