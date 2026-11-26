<?php

use App\Http\Middleware\AuditLogMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(AuditLogMiddleware::class);
        $middleware->alias([
            'admin.permission' => \App\Http\Middleware\EnsureAdminPermission::class,
            'admin.super' => \App\Http\Middleware\EnsureSuperAdministrator::class,
            'active.user' => \App\Http\Middleware\EnsureActiveUser::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
