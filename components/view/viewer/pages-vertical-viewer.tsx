import { useRouter } from "next/router";

import { useEffect, useRef, useState } from "react";
import React from "react";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { useSafePageViewTracker } from "@/lib/tracking/safe-page-view-tracker";
import { getTrackingOptions } from "@/lib/tracking/tracking-config";
import { WatermarkConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/utils/use-media-query";

import { ScreenProtector } from "../ScreenProtection";
import Nav, { TNavData } from "../nav";
import { PoweredBy } from "../powered-by";
import Question from "../question";
import Toolbar from "../toolbar";
import { SVGWatermark } from "../watermark-svg";
import { AwayPoster } from "./away-poster";

import "@/styles/custom-viewer-styles.css";

const DEFAULT_PRELOADED_IMAGES_NUM = 5;

const calculateOptimalWidth = (
  containerWidth: number,
  metadata: { width: number; height: number } | null,
  isMobile: boolean,
  isTablet: boolean,
) => {
  if (!metadata) {
    // Fallback dimensions if metadata is null
    return isMobile ? containerWidth : Math.min(800, containerWidth * 0.6);
  }

  const aspectRatio = metadata.width / metadata.height;
  const maxWidth = Math.min(1400, containerWidth); // 100% of container width, max 1400px
  const minWidth = Math.min(
    800,
    isTablet ? containerWidth * 0.9 : containerWidth * 0.6,
  ); // 60% of container width, min 600px

  // For landscape documents (width > height), use more width
  if (aspectRatio > 1) {
    return maxWidth;
  }

  // For portrait documents, use full width on mobile, min width on desktop
  return isMobile ? containerWidth : minWidth;
};

export default function PagesVerticalViewer({
  pages,
  feedbackEnabled,
  screenshotProtectionEnabled,
  versionNumber,
  showPoweredByBanner,
  enableQuestion = false,
  feedback,
  viewerEmail,
  watermarkConfig,
  ipAddress,
  linkName,
  navData,
}: {
  pages: {
    file: string;
    pageNumber: string;
    embeddedLinks: string[];
    pageLinks: { href: string; coords: string }[];
    metadata: { width: number; height: number; scaleFactor: number };
  }[];
  feedbackEnabled: boolean;
  screenshotProtectionEnabled: boolean;
  versionNumber: number;
  showPoweredByBanner?: boolean;
  enableQuestion?: boolean | null;
  feedback?: {
    id: string;
    data: { question: string; type: string };
  } | null;
  viewerEmail?: string;
  watermarkConfig?: WatermarkConfig | null;
  ipAddress?: string;
  linkName?: string;
  navData: TNavData;
}) {
  const { linkId, documentId, viewId, isPreview, dataroomId, brand } = navData;

  const router = useRouter();

  const numPages = pages.length;
  const numPagesWithFeedback =
    enableQuestion && feedback ? numPages + 1 : numPages;

  const numPagesWithAccountCreation = numPagesWithFeedback;

  const pageQuery = router.query.p ? Number(router.query.p) : 1;

  const [pageNumber, setPageNumber] = useState<number>(() =>
    pageQuery >= 1 && pageQuery <= numPages ? pageQuery : 1,
  ); // start on first page

  const [loadedImages, setLoadedImages] = useState<boolean[]>(
    new Array(numPages).fill(false),
  );

  const [submittedFeedback, setSubmittedFeedback] = useState<boolean>(false);
  const [accountCreated, setAccountCreated] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);

  const initialViewedPages = Array.from({ length: numPages }, (_, index) => ({
    pageNumber: index + 1,
    duration: 0,
  }));

  const [viewedPages, setViewedPages] =
    useState<{ pageNumber: number; duration: number }[]>(initialViewedPages);

  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const startTimeRef = useRef(Date.now());
  const pageNumberRef = useRef<number>(pageNumber);
  const visibilityRef = useRef<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollActionRef = useRef<boolean>(false);
  const hasTrackedDownRef = useRef<boolean>(false);
  const hasTrackedUpRef = useRef<boolean>(false);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  const [imageDimensions, setImageDimensions] = useState<
    Record<number, { width: number; height: number }>
  >({});

  const { isMobile, isTablet } = useMediaQuery();

  const scaleCoordinates = (coords: string, scaleFactor: number) => {
    return coords
      .split(",")
      .map((coord) => parseFloat(coord) * scaleFactor)
      .join(",");
  };

  const getScaleFactor = ({
    naturalHeight,
    scaleFactor,
  }: {
    naturalHeight: number;
    scaleFactor: number;
  }) => {
    const containerHeight = imageDimensions[pageNumber - 1]
      ? imageDimensions[pageNumber - 1]!.height
      : window.innerHeight - 64;

    // Add a safety check to prevent division by zero
    if (!naturalHeight || naturalHeight === 0) {
      return scaleFactor;
    }

    return (scaleFactor * containerHeight) / naturalHeight;
  };

  useEffect(() => {
    const updateImageDimensions = () => {
      const newDimensions: Record<number, { width: number; height: number }> =
        {};
      imageRefs.current.forEach((img, index) => {
        if (img) {
          newDimensions[index] = {
            width: img.clientWidth,
            height: img.clientHeight,
          };
        }
      });
      setImageDimensions(newDimensions);
    };

    updateImageDimensions();
    window.addEventListener("resize", updateImageDimensions);

    return () => {
      window.removeEventListener("resize", updateImageDimensions);
    };
  }, [loadedImages, pageNumber]);

  // Update the previous page number after the effect hook has run
  useEffect(() => {
    pageNumberRef.current = pageNumber;
    hasTrackedDownRef.current = false; // Reset tracking status on page number change
    hasTrackedUpRef.current = false; // Reset tracking status on page number change
  }, [pageNumber]);

  const {
    trackPageViewSafely,
    resetTrackingState,
    startIntervalTracking,
    stopIntervalTracking,
    getActiveDuration,
    isInactive,
    updateActivity,
  } = useSafePageViewTracker({
    ...getTrackingOptions(),
    externalStartTimeRef: startTimeRef,
  });

  useEffect(() => {
    if (pageNumber <= numPages) {
      const trackingData = {
        linkId,
        documentId,
        viewId,
        pageNumber: pageNumber,
        versionNumber,
        dataroomId,
        setViewedPages,
        isPreview,
      };

      startIntervalTracking(trackingData);
    }

    return () => {
      stopIntervalTracking();
    };
  }, [
    pageNumber,
    numPages,
    linkId,
    documentId,
    viewId,
    versionNumber,
    dataroomId,
    isPreview,
    startIntervalTracking,
    stopIntervalTracking,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (pageNumber > numPages) return;

      if (document.visibilityState === "visible") {
        visibilityRef.current = true;
        resetTrackingState();

        if (pageNumber <= numPages) {
          const trackingData = {
            linkId,
            documentId,
            viewId,
            pageNumber: pageNumber,
            versionNumber,
            dataroomId,
            setViewedPages,
            isPreview,
          };
          startIntervalTracking(trackingData);
        }
      } else {
        visibilityRef.current = false;
        stopIntervalTracking();

        // Track final duration using activity-aware calculation
        if (pageNumber <= numPages) {
          const duration = getActiveDuration();
          trackPageViewSafely(
            {
              linkId,
              documentId,
              viewId,
              duration,
              pageNumber: pageNumber,
              versionNumber,
              dataroomId,
              setViewedPages,
              isPreview,
            },
            true,
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    pageNumber,
    numPages,
    linkId,
    documentId,
    viewId,
    versionNumber,
    dataroomId,
    isPreview,
    trackPageViewSafely,
    resetTrackingState,
    startIntervalTracking,
    stopIntervalTracking,
    getActiveDuration,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      stopIntervalTracking();
      if (pageNumber <= numPages) {
        const duration = getActiveDuration();
        trackPageViewSafely(
          {
            linkId,
            documentId,
            viewId,
            duration,
            pageNumber: pageNumber,
            versionNumber,
            dataroomId,
            setViewedPages,
            isPreview,
          },
          true,
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    pageNumber,
    numPages,
    linkId,
    documentId,
    viewId,
    versionNumber,
    dataroomId,
    isPreview,
    trackPageViewSafely,
    stopIntervalTracking,
    getActiveDuration,
  ]);

  // Add this effect near your other useEffect hooks
  useEffect(() => {
    if (!screenshotProtectionEnabled) return;

    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [screenshotProtectionEnabled]);

  useEffect(() => {
    setLoadedImages((prev) =>
      prev.map((loaded, index) =>
        index < DEFAULT_PRELOADED_IMAGES_NUM ? true : loaded,
      ),
    );
  }, []); // Run once on mount

  useEffect(() => {
    // Remove token and email query parameters on component mount
    const removeQueryParams = (queries: string[]) => {
      const currentQuery = { ...router.query };
      const currentPath = router.asPath.split("?")[0];
      queries.map((query) => delete currentQuery[query]);

      router.replace(
        {
          pathname: currentPath,
          query: currentQuery,
        },
        undefined,
        { shallow: true },
      );
    };

    if (!dataroomId && router.query.token) {
      removeQueryParams(["token", "email", "domain", "slug", "linkId"]);
    }
  }, []); // Run once on mount

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const scrollPosition = container.scrollTop;
    const containerHeight = container.clientHeight;
    const containerRect = container.getBoundingClientRect();

    // Always preload surrounding pages during scroll
    const startPage = Math.max(0, pageNumber - 2 - 1);
    const endPage = Math.min(numPages - 1, pageNumber + 2 - 1);

    setLoadedImages((prev) => {
      const newLoadedImages = [...prev];
      for (let i = startPage; i <= endPage; i++) {
        newLoadedImages[i] = true;
      }
      return newLoadedImages;
    });

    // Find which page is most visible in the viewport
    let maxVisiblePage = pageNumber;
    let maxVisibleArea = 0;

    imageRefs.current.forEach((img, index) => {
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const visibleHeight =
        Math.min(rect.bottom, containerRect.bottom) -
        Math.max(rect.top, containerRect.top);
      const visibleArea = Math.max(0, visibleHeight);

      if (visibleArea > maxVisibleArea) {
        maxVisibleArea = visibleArea;
        maxVisiblePage = index + 1;
      }
    });

    const feedbackElement = document.getElementById("feedback-question");
    if (feedbackElement) {
      const feedbackRect = feedbackElement.getBoundingClientRect();
      const isFeedbackVisible =
        feedbackRect.top < containerRect.bottom &&
        feedbackRect.bottom > containerRect.top;

      if (isFeedbackVisible) {
        setPageNumber(numPagesWithFeedback);
        pageNumberRef.current = numPagesWithFeedback;
        startTimeRef.current = Date.now();
        return;
      }
    }

    if (maxVisiblePage !== pageNumber) {
      if (pageNumber <= numPages) {
        const duration = getActiveDuration();
        trackPageViewSafely({
          linkId,
          documentId,
          viewId,
          duration,
          pageNumber: pageNumber,
          versionNumber,
          dataroomId,
          setViewedPages,
          isPreview,
        });
      }

      setPageNumber(maxVisiblePage);
      pageNumberRef.current = maxVisiblePage;
      startTimeRef.current = Date.now();
    }
  };

  // Function to preload next image
  const preloadImage = (index: number) => {
    if (index < numPages && !loadedImages[index]) {
      const newLoadedImages = [...loadedImages];
      newLoadedImages[index] = true;
      setLoadedImages(newLoadedImages);
    }
  };

  const goToPreviousPage = () => {
    if (pageNumber <= 1) return;
    if (enableQuestion && feedback && pageNumber === numPagesWithFeedback) {
      const targetImg = imageRefs.current[pageNumber - 2];
      if (targetImg) {
        targetImg.scrollIntoView({ behavior: "smooth", block: "start" });
        setPageNumber(pageNumber - 1);
        startTimeRef.current = Date.now();
      }
      return;
    }

    if (pageNumber === numPagesWithFeedback + 1) {
      const targetImg = imageRefs.current[pageNumber - 2];
      if (targetImg) {
        targetImg.scrollIntoView({ behavior: "smooth", block: "start" });
        setPageNumber(pageNumber - 1);
        startTimeRef.current = Date.now();
      }
      return;
    }

    // Preload previous pages
    preloadImage(pageNumber - 4);

    const duration = getActiveDuration();
    trackPageViewSafely({
      linkId,
      documentId,
      viewId,
      duration,
      pageNumber: pageNumber,
      versionNumber,
      dataroomId,
      setViewedPages,
      isPreview,
    });

    const targetImg = imageRefs.current[pageNumber - 2];
    if (targetImg) {
      targetImg.scrollIntoView({ behavior: "smooth", block: "start" });
      setPageNumber(pageNumber - 1);
      startTimeRef.current = Date.now();
    }
  };

  const goToNextPage = () => {
    if (pageNumber >= numPagesWithAccountCreation) return;

    if (pageNumber === numPages && enableQuestion && feedback) {
      const feedbackElement = document.getElementById("feedback-question");
      if (feedbackElement) {
        feedbackElement.scrollIntoView({ behavior: "smooth", block: "start" });
        setPageNumber(numPagesWithFeedback);
        startTimeRef.current = Date.now();
      }
      return;
    }

    if (pageNumber > numPages) {
      const targetImg = imageRefs.current[pageNumber];
      if (targetImg) {
        targetImg.scrollIntoView({ behavior: "smooth", block: "start" });
        setPageNumber(pageNumber + 1);
        startTimeRef.current = Date.now();
      }
      return;
    }

    // Preload the next page
    preloadImage(pageNumber + 2);

    const duration = getActiveDuration();
    trackPageViewSafely({
      linkId,
      documentId,
      viewId,
      duration,
      pageNumber: pageNumber,
      versionNumber,
      dataroomId,
      setViewedPages,
      isPreview,
    });

    const targetImg = imageRefs.current[pageNumber];
    if (targetImg) {
      targetImg.scrollIntoView({ behavior: "smooth", block: "start" });
      setPageNumber(pageNumber + 1);
      startTimeRef.current = Date.now();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault(); // Prevent default behavior
        event.stopPropagation(); // Stop propagation
        goToNextPage();
        break;
      case "ArrowUp":
        event.preventDefault(); // Prevent default behavior
        event.stopPropagation(); // Stop propagation
        goToPreviousPage();
        break;
      case "ArrowRight":
        event.preventDefault(); // Prevent default behavior
        event.stopPropagation(); // Stop propagation
        goToNextPage();
        break;
      case "ArrowLeft":
        event.preventDefault(); // Prevent default behavior
        event.stopPropagation(); // Stop propagation
        goToPreviousPage();
        break;
      default:
        break;
    }
  };

  const handleLinkClick = (href: string, event: React.MouseEvent) => {
    // Check if it's an internal page link or external link
    const pageMatch = href.match(/#page=(\d+)/);
    if (pageMatch) {
      event.preventDefault();
      const targetPage = parseInt(pageMatch[1]);
      if (targetPage >= 1 && targetPage <= numPages) {
        // Track the current page before jumping
        const duration = getActiveDuration();
        trackPageViewSafely({
          linkId,
          documentId,
          viewId,
          duration,
          pageNumber: pageNumber,
          versionNumber,
          dataroomId,
          setViewedPages,
          isPreview,
        });

        // Preload target page and 2 pages on either side
        const startPage = Math.max(0, targetPage - 2 - 1);
        const endPage = Math.min(numPages - 1, targetPage + 2 - 1);

        setLoadedImages((prev) => {
          const newLoadedImages = [...prev];
          for (let i = startPage; i <= endPage; i++) {
            newLoadedImages[i] = true;
          }
          return newLoadedImages;
        });

        setPageNumber(targetPage);
        pageNumberRef.current = targetPage;
        if (containerRef.current) {
          scrollActionRef.current = true;
          const newScrollPosition =
            ((targetPage - 1) * containerRef.current.scrollHeight) /
            numPagesWithAccountCreation;
          containerRef.current.scrollTo({
            top: newScrollPosition,
            behavior: "smooth",
          });
        }

        // Reset the start time for the new page
        startTimeRef.current = Date.now();
      }
    } else {
      // Track external link clicks
      if (!isPreview && viewId) {
        fetch("/api/record_click", {
          method: "POST",
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            sessionId: viewId,
            linkId,
            documentId,
            viewId,
            pageNumber: pageNumber.toString(),
            href,
            versionNumber,
            dataroomId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(console.error); // Non-blocking
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, goToNextPage, goToPreviousPage]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll]);

  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Add resize observer to track container width
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5)); // Min zoom 0.5x
  };

  // Add keyboard shortcuts for zooming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          setScale(1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Nav
        pageNumber={pageNumber}
        numPages={numPagesWithAccountCreation}
        embeddedLinks={pages[pageNumber - 1]?.embeddedLinks}
        hasWatermark={watermarkConfig ? true : false}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        navData={navData}
      />
      <div
        style={{ height: "calc(100dvh - 64px)" }}
        className={cn("relative h-dvh overflow-hidden")}
      >
        <div
          className={cn(
            "h-full w-full",
            "overflow-auto scroll-smooth",
            !isWindowFocused &&
              screenshotProtectionEnabled &&
              "blur-xl transition-all duration-300",
          )}
          ref={containerRef}
        >
          <div className="flex min-h-full min-w-full justify-center">
            <div className="flex w-full max-w-[1400px] justify-center">
              <div
                className="transform-container w-full"
                style={{
                  transform: `scale(${scale})`,
                  transition: "transform 0.2s ease-out",
                  transformOrigin: scale <= 1 ? "center top" : "left top",
                }}
              >
                <div
                  className="flex flex-col items-center gap-2"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {pages.map((page, index) =>
                    loadedImages[index] ? (
                      <div
                        key={index}
                        className="relative w-full px-4 md:px-8"
                        style={{
                          width: containerWidth
                            ? `${calculateOptimalWidth(containerWidth, page.metadata, isMobile, isTablet)}px`
                            : undefined,
                        }}
                      >
                        <div className="viewer-container relative border-b border-t border-gray-100">
                          <div
                            className="pointer-events-none absolute bottom-0 left-0 w-px"
                            style={{
                              height: "10%",
                              background:
                                "linear-gradient(to top, #f3f4f6, transparent)",
                            }}
                          />
                          <div
                            className="pointer-events-none absolute bottom-0 right-0 w-px"
                            style={{
                              height: "10%",
                              background:
                                "linear-gradient(to top, #f3f4f6, transparent)",
                            }}
                          />
                          <div
                            className="pointer-events-none absolute left-0 top-0 w-px"
                            style={{
                              height: "10%",
                              background:
                                "linear-gradient(to bottom, #f3f4f6, transparent)",
                            }}
                          />
                          <div
                            className="pointer-events-none absolute right-0 top-0 w-px"
                            style={{
                              height: "10%",
                              background:
                                "linear-gradient(to bottom, #f3f4f6, transparent)",
                            }}
                          />
                          <img
                            className="viewer-image-mobile h-auto w-full object-contain"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            ref={(ref) => {
                              imageRefs.current[index] = ref;
                              if (ref) {
                                ref.onload = () =>
                                  setImageDimensions((prev) => ({
                                    ...prev,
                                    [index]: {
                                      width: ref.clientWidth,
                                      height: ref.clientHeight,
                                    },
                                  }));
                              }
                            }}
                            useMap={`#page-map-${index + 1}`}
                            src={
                              loadedImages[index]
                                ? page.file
                                : "https://www.papermark.com/_static/blank.gif"
                            }
                            alt={`Page ${index + 1}`}
                          />

                          {watermarkConfig && imageDimensions[index] ? (
                            <div className="absolute left-0 top-0">
                              <SVGWatermark
                                config={watermarkConfig}
                                viewerData={{
                                  email: viewerEmail,
                                  date: new Date().toLocaleDateString(),
                                  time: new Date().toLocaleTimeString(),
                                  link: linkName,
                                  ipAddress: ipAddress,
                                }}
                                documentDimensions={imageDimensions[index]}
                                pageIndex={index}
                              />
                            </div>
                          ) : null}
                        </div>

                        {page.pageLinks ? (
                          <map name={`page-map-${index + 1}`}>
                            {page.pageLinks
                              .filter((link) => !link.href.endsWith(".gif"))
                              .map((link, linkIndex) => (
                                <area
                                  key={linkIndex}
                                  shape="rect"
                                  coords={scaleCoordinates(
                                    link.coords,
                                    getScaleFactor({
                                      naturalHeight: page.metadata.height,
                                      scaleFactor: page.metadata.scaleFactor,
                                    }),
                                  )}
                                  href={link.href}
                                  onClick={(e) => handleLinkClick(link.href, e)}
                                  target={
                                    link.href.startsWith("#")
                                      ? "_self"
                                      : "_blank"
                                  }
                                  rel={
                                    link.href.startsWith("#")
                                      ? undefined
                                      : "noopener noreferrer"
                                  }
                                />
                              ))}
                          </map>
                        ) : null}

                        {page.pageLinks
                          ? page.pageLinks
                              .filter((link) => link.href.endsWith(".gif"))
                              .map((link, linkIndex) => {
                                const [x1, y1, x2, y2] = scaleCoordinates(
                                  link.coords,
                                  getScaleFactor({
                                    naturalHeight: page.metadata.height,
                                    scaleFactor: page.metadata.scaleFactor,
                                  }),
                                )
                                  .split(",")
                                  .map(Number);

                                const overlayWidth = x2 - x1;
                                const overlayHeight = y2 - y1;

                                return (
                                  <img
                                    key={`overlay-${index}-${linkIndex}`}
                                    src={link.href}
                                    alt={`Overlay ${index + 1}`}
                                    style={{
                                      position: "absolute",
                                      top: y1,
                                      left: x1,
                                      width: `${overlayWidth}px`,
                                      height: `${overlayHeight}px`,
                                      pointerEvents: "none",
                                    }}
                                  />
                                );
                              })
                          : null}
                      </div>
                    ) : null,
                  )}

                  {enableQuestion &&
                    feedback &&
                    pageNumber >= numPagesWithFeedback - 1 && (
                      <div
                        id="feedback-question"
                        className={cn("relative block h-dvh w-full")}
                        style={{ height: "calc(100dvh - 64px)" }}
                      >
                        <Question
                          accentColor={brand?.accentColor}
                          feedback={feedback}
                          viewId={viewId}
                          submittedFeedback={submittedFeedback}
                          setSubmittedFeedback={setSubmittedFeedback}
                          isPreview={isPreview}
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Up arrow - hide on first page */}
        <div
          className={cn(
            "absolute left-0 right-0 top-0 flex h-24 items-start justify-center pt-4 transition-opacity duration-200",
            pageNumber <= 1 ? "hidden" : "opacity-0 hover:opacity-100",
          )}
          onClick={goToPreviousPage}
        >
          <button
            disabled={pageNumber <= 1}
            className="rounded-full bg-gray-950/50 p-1 hover:bg-gray-950/75"
          >
            <ChevronUpIcon className="h-10 w-10 text-white" />
          </button>
        </div>

        {/* Down arrow - hide on last page unless there's an account creation page */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 flex h-24 items-end justify-center pb-4 transition-opacity duration-200",
            pageNumber >= numPagesWithAccountCreation
              ? "hidden"
              : "opacity-0 hover:opacity-100",
          )}
          onClick={goToNextPage}
        >
          <button
            disabled={pageNumber >= numPagesWithAccountCreation}
            className="rounded-full bg-gray-950/50 p-1 hover:bg-gray-950/75"
          >
            <ChevronDownIcon className="h-10 w-10 text-white" />
          </button>
        </div>

        {feedbackEnabled && pageNumber <= numPages ? (
          <Toolbar
            viewId={viewId}
            pageNumber={pageNumber}
            isPreview={isPreview}
          />
        ) : null}

        {screenshotProtectionEnabled ? <ScreenProtector /> : null}
        {showPoweredByBanner ? <PoweredBy linkId={linkId} /> : null}
        <AwayPoster
          isVisible={isInactive}
          inactivityThreshold={
            getTrackingOptions().inactivityThreshold || 20000
          }
          onDismiss={updateActivity}
        />
      </div>
    </>
  );
}
