<script>
  const COUNTRIES = ['United Kingdom', 'United States', 'Ireland']
  const EVENT_TYPES = ['competition', 'workshop', 'other']
  const DISCIPLINES = [
    { value: 'wag', label: "Women's Artistic" },
    { value: 'mag', label: "Men's Artistic" },
    { value: 'tum', label: 'Tumble' },
    { value: 'fv', label: 'Floor & Vault' },
    { value: 'tra', label: 'Trampoline' },
    { value: 'acro', label: 'Acro' },
  ]

  let me = $state(undefined) // undefined = loading, null = logged out
  let events = $state([])
  let selected = $state([]) // array of sks
  let editingSk = $state(null) // null = create form, sk = edit form
  let loadError = $state('')
  let saveError = $state('')
  let saving = $state(false)

  let users = $state([])
  let newUserEmail = $state('')
  let usersError = $state('')

  let audit = $state([])

  let form = $state(emptyForm())

  function emptyForm() {
    return {
      name: '',
      country: '',
      date: '',
      minimumAge: null,
      eventType: 'other',
      entriesOpen: '',
      entriesClose: '',
      disciplines: [],
      details: '',
      imageUrl: null,
    }
  }

  $effect(() => {
    init()
  })

  async function init() {
    const meResponse = await fetch('/api/me')
    if (meResponse.status === 401) {
      me = null
      return
    }
    me = await meResponse.json()
    await loadEvents()
    if (me.isSuperuser) await loadUsers()
  }

  async function loadUsers() {
    const response = await fetch('/api/users')
    if (response.ok) users = (await response.json()).users
  }

  async function addUser() {
    usersError = ''
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail }),
    })
    if (!response.ok) {
      usersError = (await response.json().catch(() => ({}))).error ?? 'Failed to add user.'
      return
    }
    users = (await response.json()).users
    newUserEmail = ''
  }

  async function removeUser(email) {
    usersError = ''
    const response = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      usersError = (await response.json().catch(() => ({}))).error ?? 'Failed to remove user.'
      return
    }
    users = (await response.json()).users
  }

  async function loadEvents() {
    const response = await fetch('/api/events')
    if (!response.ok) {
      loadError = 'Failed to load events. Please refresh.'
      return
    }
    events = (await response.json()).events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    // Drop selections for events that no longer exist
    const sks = new Set(events.map((e) => e.sk))
    selected = selected.filter((sk) => sks.has(sk))
    if (editingSk !== null && !sks.has(editingSk)) editingSk = null
  }

  function selectedEvents() {
    return events.filter((e) => selected.includes(e.sk))
  }

  function toggleSelect(sk) {
    selected = selected.includes(sk) ? selected.filter((s) => s !== sk) : [...selected, sk]
  }

  function startEdit(event) {
    editingSk = event.sk
    saveError = ''
    loadAudit(event.sk)
    form = {
      name: event.name ?? '',
      country: event.country ?? '',
      date: event.date ?? '',
      minimumAge: event.minimumAge ?? null,
      eventType: event.eventType ?? 'other',
      entriesOpen: event.entriesOpen ?? '',
      entriesClose: event.entriesClose ?? '',
      disciplines: [...(event.disciplines ?? [])],
      details: event.details ?? '',
      imageUrl: event.imageUrl ?? null,
    }
  }

  function startCreate() {
    editingSk = null
    saveError = ''
    audit = []
    form = emptyForm()
  }

  async function loadAudit(sk) {
    audit = []
    const response = await fetch(`/api/events/${encodeURIComponent(sk)}/audit`)
    if (response.ok) audit = (await response.json()).entries
  }

  function formatAuditValue(value) {
    if (value == null || value === '') return '(empty)'
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    return text.length > 80 ? `${text.slice(0, 80)}…` : text
  }

  function formatAuditTime(epochSeconds) {
    return new Date(epochSeconds * 1000).toLocaleString('en-GB')
  }

  async function uploadImage(fileInput) {
    const file = fileInput.target.files[0]
    if (!file) return
    saveError = ''
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/image', { method: 'POST', body })
    if (!response.ok) {
      saveError = 'Failed to upload image. Please try again.'
      return
    }
    form.imageUrl = (await response.json()).url
  }

  async function save() {
    saving = true
    saveError = ''
    const payload = {
      ...form,
      entriesOpen: form.entriesOpen || null,
      entriesClose: form.entriesClose || null,
    }
    const response = await fetch(editingSk ? `/api/events/${encodeURIComponent(editingSk)}` : '/api/events', {
      method: editingSk ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    saving = false
    if (!response.ok) {
      const { error } = await response.json().catch(() => ({}))
      saveError = error ?? 'Failed to save event. Please try again.'
      return
    }
    await loadEvents()
    startCreate()
  }

  async function remove(sks) {
    const names = events.filter((e) => sks.includes(e.sk)).map((e) => e.name)
    if (!confirm(`Delete ${sks.length > 1 ? `${sks.length} events` : `"${names[0]}"`}? This cannot be undone.`)) return
    const response = await fetch('/api/events/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sks }),
    })
    if (!response.ok) {
      saveError = 'Failed to delete event(s). Please try again.'
      return
    }
    selected = selected.filter((sk) => !sks.includes(sk))
    if (sks.includes(editingSk)) editingSk = null
    await loadEvents()
  }

  function toggleDiscipline(value) {
    form.disciplines = form.disciplines.includes(value)
      ? form.disciplines.filter((d) => d !== value)
      : [...form.disciplines, value]
  }
</script>

{#if me === undefined}
  <p class="container mt-4 text-center text-secondary">Loading…</p>
{:else if me === null}
  <div class="container mt-5 text-center">
    <h3>Gymnastics Events Manager</h3>
    <a class="btn btn-primary btn-lg mt-3" href="/login">Log in with Google</a>
  </div>
{:else}
  <div class="container-fluid mt-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Gymnastics Events</h3>
      <div>
        <span class="text-secondary me-3"><small>Logged in as: {me.email}</small></span>
        <a href="/logout" class="btn btn-outline-secondary btn-sm">Log out</a>
      </div>
    </div>

    {#if loadError}
      <div class="alert alert-danger">{loadError}</div>
    {/if}

    {#if events.length === 0}
      <div class="alert alert-info">No events found. Create a new event below.</div>
    {:else}
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th></th>
            <th>Event Name</th>
            <th>Country</th>
            <th>Date</th>
            <th>Entries Open</th>
            <th>Entries Close</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each events as event (event.sk)}
            <tr class:table-active={selected.includes(event.sk)}>
              <td>
                <input
                  class="form-check-input"
                  type="checkbox"
                  checked={selected.includes(event.sk)}
                  onchange={() => toggleSelect(event.sk)}
                />
              </td>
              <td>{event.name}</td>
              <td>{event.country}</td>
              <td>{event.date}</td>
              <td>{event.entriesOpen ?? 'N/A'}</td>
              <td>{event.entriesClose ?? 'N/A'}</td>
              <td><button class="btn btn-sm btn-outline-primary" onclick={() => startEdit(event)}>Edit</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if selected.length > 1}
      <div class="d-flex align-items-center gap-3 mb-4">
        <span>{selected.length} events selected.</span>
        <button class="btn btn-outline-danger btn-sm" onclick={() => remove(selected)}>
          Delete {selected.length} Events
        </button>
      </div>
    {:else}
      <p class="text-secondary">Select an event from the table above to edit it, or create a new event below.</p>
    {/if}

    <hr />

    <h5>{editingSk ? 'Edit Event' : 'Create New Event'}</h5>

    {#if saveError}
      <div class="alert alert-danger">{saveError}</div>
    {/if}

    <form class="row g-3 mb-3" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <div class="col-md-6">
        <label class="form-label" for="name">Event Name*</label>
        <input class="form-control" id="name" bind:value={form.name} required />
      </div>
      <div class="col-md-6">
        <label class="form-label" for="country">Country*</label>
        <input class="form-control" id="country" list="country-options" bind:value={form.country} required />
        <datalist id="country-options">
          {#each COUNTRIES as country}
            <option value={country} />
          {/each}
        </datalist>
      </div>
      <div class="col-md-3">
        <label class="form-label" for="date">Date*</label>
        <input class="form-control" id="date" type="date" bind:value={form.date} required />
      </div>
      <div class="col-md-3">
        <label class="form-label" for="minimumAge">Minimum Age</label>
        <input class="form-control" id="minimumAge" type="number" min="0" max="100" bind:value={form.minimumAge} />
      </div>
      <div class="col-md-3">
        <label class="form-label" for="eventType">Event Type</label>
        <select class="form-select" id="eventType" bind:value={form.eventType}>
          {#each EVENT_TYPES as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label" for="entriesOpen">Entries Open</label>
        <input class="form-control" id="entriesOpen" type="date" bind:value={form.entriesOpen} />
      </div>
      <div class="col-md-3">
        <label class="form-label" for="entriesClose">Entries Close</label>
        <input class="form-control" id="entriesClose" type="date" bind:value={form.entriesClose} />
      </div>
      <div class="col-md-6">
        <label class="form-label d-block">Discipline(s)</label>
        {#each DISCIPLINES as d}
          <div class="form-check form-check-inline">
            <input
              class="form-check-input"
              type="checkbox"
              id="discipline-{d.value}"
              checked={form.disciplines.includes(d.value)}
              onchange={() => toggleDiscipline(d.value)}
            />
            <label class="form-check-label" for="discipline-{d.value}">{d.label}</label>
          </div>
        {/each}
      </div>
      <div class="col-12">
        <label class="form-label" for="details">Event Details (Markdown supported)</label>
        <textarea class="form-control" id="details" rows="6" bind:value={form.details}></textarea>
      </div>
      <div class="col-md-6">
        <label class="form-label" for="image">{form.imageUrl ? 'Replace Event Image' : 'Set Event Image'}</label>
        <input class="form-control" id="image" type="file" accept="image/png,image/jpeg" onchange={uploadImage} />
        {#if form.imageUrl}
          <img src={form.imageUrl} alt="Event image preview" class="mt-2 rounded" style="max-width: 300px" />
        {/if}
      </div>
      <div class="col-12">
        <button class="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : editingSk ? 'Update Event' : 'Create Event'}
        </button>
        {#if editingSk}
          <button class="btn btn-outline-secondary ms-2" type="button" onclick={startCreate}>Cancel</button>
          <button class="btn btn-outline-danger ms-2" type="button" onclick={() => remove([editingSk])}>
            Delete Event
          </button>
        {/if}
      </div>
    </form>

    {#if editingSk}
      <h5 class="mt-4">History</h5>
      {#if audit.length === 0}
        <p class="text-secondary"><small>No history recorded for this event.</small></p>
      {:else}
        <ul class="list-unstyled small">
          {#each audit as entry (entry.at + entry.action)}
            <li class="mb-2">
              <strong>{entry.action}</strong> by {entry.by} at {formatAuditTime(entry.at)}
              {#if Object.keys(entry.changes ?? {}).length > 0}
                <ul class="mb-0">
                  {#each Object.entries(entry.changes) as [field, change]}
                    <li><code>{field}</code>: {formatAuditValue(change.from)} → {formatAuditValue(change.to)}</li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <small class="text-secondary">Please note, updates take a minute to reflect on the main page.</small>

    {#if me.isSuperuser}
      <hr />
      <h5>Allowed users</h5>
      <p class="text-secondary">
        <small>
          You are the superuser (configured via the SUPERUSER_EMAIL secret). Users listed here can
          log in and edit events; they cannot manage this list.
        </small>
      </p>
      {#if usersError}
        <div class="alert alert-danger py-2">{usersError}</div>
      {/if}
      <form
        class="row row-cols-sm-auto g-2 align-items-center mb-2"
        onsubmit={(e) => {
          e.preventDefault()
          addUser()
        }}
      >
        <div class="col-12">
          <input class="form-control" type="email" placeholder="user@example.com" bind:value={newUserEmail} required />
        </div>
        <div class="col-12">
          <button class="btn btn-outline-primary" type="submit">Add user</button>
        </div>
      </form>
      {#if users.length > 0}
        <ul class="list-group" style="max-width: 28rem">
          {#each users as user (user)}
            <li class="list-group-item d-flex justify-content-between align-items-center">
              {user}
              <button class="btn btn-sm btn-outline-danger" onclick={() => removeUser(user)}>Remove</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="text-secondary"><small>No additional users. Only you can log in.</small></p>
      {/if}
    {/if}
  </div>
{/if}
