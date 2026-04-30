const bannerButtons = [
  {
    id: 'browse-auctions',
    label: 'Browse Auctions',
    href: '/auctions',
    title: 'Find Your Next Treasure',
    description: 'Browse live and upcoming auctions from verified BIDPal sellers.',
  },
  {
    id: 'join-live-auction',
    label: 'Join a Live Auction',
    href: '/live',
    title: 'Live Now. Bid Now.',
    description: 'See live sessions that are happening right now and jump into the auction room.',
  },
  {
    id: 'buyer-protection',
    label: 'Learn More',
    href: '/buyer-protection',
    title: 'Bid with Confidence',
    description: 'Learn how BIDPal protects buyers with seller checks, secure payments, and dispute support.',
  },
];

export const getBannerButtons = async (req, res) => {
  res.json({ data: bannerButtons });
};

export const trackBannerButtonClick = async (req, res) => {
  const { id } = req.params;
  const button = bannerButtons.find(item => item.id === id);

  if (!button) {
    return res.status(404).json({ error: 'Banner button not found' });
  }

  console.log(`[banner-click] ${id}`, {
    href: button.href,
    user_id: req.body?.user_id || null,
    clicked_at: new Date().toISOString(),
  });

  res.json({ success: true, button });
};
