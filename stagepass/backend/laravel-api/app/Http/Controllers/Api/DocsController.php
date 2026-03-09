<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class DocsController extends Controller
{
    private function guidesPath(): string
    {
        $base = base_path();
    
        // stagepass/docs/guides
        $candidate = realpath(
            $base . DIRECTORY_SEPARATOR . '..' .
            DIRECTORY_SEPARATOR . '..' .
            DIRECTORY_SEPARATOR . 'docs' .
            DIRECTORY_SEPARATOR . 'guides'
        );
    
        if ($candidate !== false && is_dir($candidate)) {
            return $candidate;
        }
    
        $fallback = $base . DIRECTORY_SEPARATOR . 'resources' .
            DIRECTORY_SEPARATOR . 'docs' .
            DIRECTORY_SEPARATOR . 'guides';
    
        if (is_dir($fallback)) {
            return $fallback;
        }
    
        // Always return a string path even if it doesn't exist
        return $fallback;
    }

    /**
     * List available guide names.
     */
    public function index(Request $request): JsonResponse
    {
        $path = $this->guidesPath();
        if (! $path || ! is_dir($path)) {
            return response()->json(['guides' => []]);
        }
        $files = File::files($path);
        $guides = [];
        foreach ($files as $file) {
            $name = $file->getFilenameWithoutExtension();
            if (str_ends_with($file->getFilename(), '.md') && $name !== 'README') {
                $guides[] = ['id' => $name, 'title' => $this->guideTitle($name)];
            }
        }
        usort($guides, fn ($a, $b) => strcmp($a['title'], $b['title']));

        return response()->json(['guides' => $guides]);
    }

    /**
     * Get one guide's markdown content.
     */
    public function show(Request $request, string $name): JsonResponse
    {
        $name = preg_replace('/[^a-z0-9\-_]/', '', strtolower($name));
        if ($name === '') {
            return response()->json(['message' => 'Invalid guide name.'], 422);
        }
        $path = $this->guidesPath();
        $file = $path ? $path . DIRECTORY_SEPARATOR . $name . '.md' : null;
        if (! $file || ! is_file($file)) {
            return response()->json(['message' => 'Guide not found.'], 404);
        }
        $content = File::get($file);

        return response()->json([
            'id' => $name,
            'title' => $this->guideTitle($name),
            'content' => $content,
        ]);
    }

    private function guideTitle(string $id): string
    {
        $titles = [
            'mobile-user-guide' => 'Mobile App – User Guide',
            'web-admin-guide' => 'Web Admin – User Guide',
        ];

        return $titles[$id] ?? str_replace('-', ' ', ucfirst($id));
    }
}
