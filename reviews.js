/* Reader reviews for Almost, Always.
   Configure these with your Supabase project URL and publishable/anon key.
   Never put a Supabase secret/service-role key in this public file. */
(() => {
  const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
  const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";
  const form = document.getElementById("reader-review-form");
  const list = document.getElementById("review-list");
  const loading = document.getElementById("review-loading");
  const status = document.getElementById("review-status");
  const submit = document.getElementById("review-submit");

  if (!form || !list) return;
  if (SUPABASE_URL.startsWith("YOUR_") || SUPABASE_ANON_KEY.startsWith("YOUR_")) {
    loading.textContent = "Reader reviews are not connected yet. The author needs to finish the one-time database setup.";
    submit.disabled = true;
    status.textContent = "Setup required: configure Supabase in reviews.js.";
    return;
  }

  const loadSupabase = () => new Promise((resolve, reject) => {
    if (window.supabase) return resolve(window.supabase);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => window.supabase ? resolve(window.supabase) : reject(new Error("Could not load review service."));
    script.onerror = () => reject(new Error("Could not load review service."));
    document.head.appendChild(script);
  });

  let client;
  const escapeText = (value) => String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, {year:"numeric",month:"short",day:"numeric"});
  };
  const renderReviews = (reviews) => {
    loading.hidden = true;
    if (!reviews.length) {
      list.innerHTML = '<p class="review-empty">You can be the first to review <em>Almost, Always</em>.</p>';
      return;
    }
    list.innerHTML = reviews.map(item => `
      <article class="reader-review" style="text-align:left;border-top:1px solid var(--line);padding:20px 0">
        <div aria-label="${item.rating} out of 5 stars" style="color:var(--accent);font:22px Arial,sans-serif;letter-spacing:2px">${"★".repeat(item.rating)}${"☆".repeat(5-item.rating)}</div>
        <p style="white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 12px">${escapeText(item.review_text)}</p>
        <p class="review-note" style="margin:0">— ${escapeText(item.reader_name)} · ${escapeText(formatDate(item.created_at))}</p>
      </article>`).join("");
  };
  const fetchReviews = async () => {
    const {data, error} = await client.from("reader_reviews")
      .select("id, reader_name, rating, review_text, created_at")
      .eq("approved", true).order("created_at", {ascending:false}).limit(100);
    if (error) throw error;
    renderReviews(data || []);
  };

  (async () => {
    try {
      const supabase = await loadSupabase();
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await fetchReviews();
      client.channel("reader-reviews-live")
        .on("postgres_changes", {event:"INSERT",schema:"public",table:"reader_reviews"}, () => fetchReviews().catch(console.error))
        .subscribe();
    } catch (error) {
      loading.hidden = false;
      loading.textContent = "Reviews could not be loaded right now. Please try again later.";
      console.error("Reader reviews:", error);
    }
  })();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) { status.textContent = "Reviews are not connected yet. Please try again later."; return; }
    const reader_name = document.getElementById("reader-name").value.trim();
    const review_text = document.getElementById("reader-review").value.trim();
    const rating = Number(new FormData(form).get("rating"));
    if (!reader_name || !review_text || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      status.textContent = "Please enter your name, choose a rating, and write a review.";
      return;
    }
    submit.disabled = true;
    status.textContent = "Publishing…";
    const {error} = await client.from("reader_reviews").insert({reader_name, rating, review_text});
    submit.disabled = false;
    if (error) {
      status.textContent = "Your review could not be published. Please try again in a moment.";
      console.error("Review submission:", error);
      return;
    }
    form.reset();
    document.getElementById("rating-5").checked = true;
    status.textContent = "Thank you — your review has been submitted.";
    try { await fetchReviews(); } catch (err) { console.error(err); }
  });
})();