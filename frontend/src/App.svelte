<script lang="ts">
  import EventItem from './lib/EventItem.svelte'
  import { Button, Container, Input } from '@sveltestrap/sveltestrap'
  import type { Event } from './lib/types'

  let events = $state<Event[]>([])
  
  // UI Elements
  let showFilters = $state(false)
  
  // Filters
  let ukIrelandOnly = $state(false)

  const toggleFilters = () => showFilters = !showFilters;

  let filteredEvents = $derived(() => {
    let filtered = events

    if (ukIrelandOnly) {
      filtered = filtered.filter(event => 
        event.country === 'United Kingdom' || event.country === 'Ireland'
      )
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
    <p class="text-secondary">This site is intended to showcase events for adult gymnasts in the UK &amp; Ireland.</p>
    <Button block color="primary" class="mb-3" on:click={toggleFilters}>
      Filter
    </Button>

    {#if showFilters}
      <div class="mb-3">
        <Input type="switch" label="UK/IE Only" bind:checked={ukIrelandOnly} />
      </div>
    {/if}

    {#each filteredEvents() as event}
      <EventItem {event} />
    {/each}
  </Container>
</main>
