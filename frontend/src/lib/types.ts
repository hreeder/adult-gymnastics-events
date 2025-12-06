export type DateString = string // Format: YYYY-MM-DD

export interface Event {
  name: string
  country: string
  date: DateString
  details: string

  imageUrl?: string

  disciplines?: {
    fv?: boolean    // Floor & Vault
    wag?: boolean   // Women's Artistic
    mag?: boolean   // Men's Artistic
    tra?: boolean   // Trampoline
    acro?: boolean  // Acrobatic
    tum?: boolean   // Tumbling
  }

  entriesOpen?: DateString
  entriesClose?: DateString
}
