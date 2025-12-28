<script lang="ts">
  import { marked } from 'marked'
  import type { DateString, Event } from "./types";

  interface Props {
    event: Event;
  }

  let { event }: Props = $props();

  const defaultImageUrl = "https://images.unsplash.com/photo-1505619730259-b1288d154955";
  const imageUrl = () => { return event.imageUrl || defaultImageUrl };

  const showEntryDates = () => {
    return event.entriesOpen || event.entriesClose;
  };

  function formatDate(dateString: DateString): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatDisciplineText(discipline: string): string {
    switch (discipline) {
      case "fv":
        return "Floor & Vault";
      case "tra":
        return "Trampoline";
      case "acro":
        return "Acro";
      case "tum":
        return "Tumble";
      default:
        return discipline.toLocaleUpperCase();
    }
  }

  type EntryState = "open" | "closed" | "closing-soon" | undefined;
  function getEntryState(): EntryState {
    const now = new Date();
    if (event.entriesOpen && event.entriesClose) {
      const openDate = new Date(event.entriesOpen);
      const closeDate = new Date(event.entriesClose);
      const timeDiff = closeDate.getTime() - now.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      
      if (now < openDate) {
        return undefined;
      } else if (now < closeDate && daysDiff <= 30) {
        return "closing-soon";
      } else if (now >= openDate && now <= closeDate) {
        return "open";
      } else {
        return "closed";
      }
    }
    return undefined;
  }
</script>

<div class="card mb-3">
  <div class="row g-0 align-items-stretch">
    <div class="col-12 d-md-none position-relative overflow-hidden">
      <div class="ratio ratio-16x9">
        <img
          src={imageUrl()}
          class="img-fluid rounded-top w-100 h-100"
          style="object-fit: cover;"
          alt={event.name}
        />
      </div>

      <div
        class="position-absolute bottom-0 start-0 end-0"
        style="height: 30px; background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.3));"
      ></div>
    </div>

    <div
      class="col-md-3 d-none d-md-block position-relative overflow-hidden max-h-md-200 h-100"
    >
      <img
        src={imageUrl()}
        class="img-fluid rounded-start w-100 h-100"
        style="object-fit: cover;"
        alt={event.name}
      />
    </div>
    <div class="col-md-9">
      <div class="card-body">
        <h5 class="card-title">
          {event.name}
          {#if getEntryState() === 'open'}
            <span class="badge text-bg-success ms-2">Entries Open</span>
          {:else if getEntryState() === 'closing-soon'}
            <span class="badge text-bg-warning ms-2">Entries Closing Soon</span>
          {:else if getEntryState() === 'closed'}
            <span class="badge text-bg-secondary ms-2">Entries Closed</span>
          {/if}
        </h5>

        <h6 class="card-subtitle mb-2 text-body-secondary">
          {event.country} • {formatDate(event.date)}
        </h6>
        
        {#if event.disciplines}
          {#each event.disciplines as discipline}
              <span class="badge rounded-pill text-bg-primary">
                {formatDisciplineText(discipline)}
              </span>
          {/each}
        {/if}
        
        <p class="card-text">
          {@html marked(event.details)}
        </p>
      </div>
      {#if showEntryDates()}
      <div class="card-footer">
          <small>
            {#if event.entriesOpen}
              Entries Open: {formatDate(event.entriesOpen)}
            {/if}
            {#if event.entriesClose}
              <br />
              Entries Close: {formatDate(event.entriesClose)}
            {/if}
          </small>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Custom CSS */
  @media (min-width: 768px) {
    .max-h-md-200 {
      max-height: 200px;
    }
  }
</style>
