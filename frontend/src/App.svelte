<script lang="ts">
  import EventItem from './lib/EventItem.svelte'
  import { Button, Container, Input } from '@sveltestrap/sveltestrap'
  import Select from 'svelte-select'
  import type { Event } from './lib/types'
  import { onMount } from 'svelte'

  const lsPrefix = 'gym-events-'

  let events = $state<Event[]>([])
  
  // UI Elements
  let showFilters = $state(false)
  let countryOptions = $derived(() => {
    const eventCountries = Array.from(new Set(events.map(e => e.country)))
      .sort()
      .map(country => ({ label: country, value: country }))
    
    // Add any previously selected countries not in the event data
    const selected = (selectedCountries || []).filter(
      c => !eventCountries.some(opt => opt.value === c.value)
    )
    
    return [...eventCountries, ...selected]
  });
  
  // Filters
  let selectedCountries = $state([])

  // Load selected countries from localStorage on mount (only once)
  onMount(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${lsPrefix}selectedCountries`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            selectedCountries = parsed
          }
        } catch {}
      }
    }
  })

  // Save selected countries to localStorage whenever they change
  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${lsPrefix}selectedCountries`, JSON.stringify(selectedCountries))
    }
  })

  const toggleFilters = () => showFilters = !showFilters;

  let filteredEvents = $derived(() => {
    let filtered = events
    if (selectedCountries && selectedCountries.length > 0) {
      const selected = selectedCountries.map(c => c.value)
      filtered = filtered.filter(event => selected.includes(event.country))
    }
    return filtered
  })

  $effect(() => {
    fetch('/data/events.json')
      .then(response => response.json())
      .then(data => events = data.events.sort((a: Event, b: Event) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }))
  })
</script>

<main>
  <Container fluid>
    <h3 class="text-center">Upcoming Adult Gymnastics Events</h3>
    <Button block color="primary" class="mb-3" on:click={toggleFilters}>
      Filter
    </Button>


    {#if showFilters}
      <div class="mb-3">
        <label for="country-select">Countries</label>
        <Select
          id="country-select"
          items={countryOptions()}
          bind:value={selectedCountries}
          multiple={true}
          placeholder="Select countries..."
        />

      </div>
    {/if}

    {#each filteredEvents() as event}
      <EventItem {event} />
    {/each}
  </Container>
</main>
