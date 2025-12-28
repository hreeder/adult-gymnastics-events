export type DateString = string // Format: YYYY-MM-DD

export interface Event {
  name: string
  country: string
  date: DateString
  details: string

  imageUrl?: string

  disciplines?: Array<'fv' | 'wag' | 'mag' | 'tra' | 'acro' | 'tum'>

  entriesOpen?: DateString
  entriesClose?: DateString
}
