---
layout: default
---

<script>
  (function() {
    const lang = window.navigator.language;
    if (lang.startsWith('ja')) {
      window.location.href = '{{ site.baseurl }}/ja/';
    } else {
      window.location.href = '{{ site.baseurl }}/en/';
    }
  })();
</script>
